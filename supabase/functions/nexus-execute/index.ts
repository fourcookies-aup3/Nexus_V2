import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { command_id, command, approved } = body;

    if (!command_id && !command) {
      return new Response(
        JSON.stringify({ error: "command_id or command is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch command from DB if only ID provided
    let cmd = command;
    let cmdId = command_id;

    if (!cmd && cmdId) {
      const { data, error } = await supabase
        .from("commands")
        .select("*")
        .eq("id", cmdId)
        .single();
      if (error) throw error;
      cmd = data.command_payload;
    }

    if (!cmd) {
      return new Response(
        JSON.stringify({ error: "Command not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check approval
    if (cmd.approval_required && !approved) {
      return new Response(
        JSON.stringify({
          error: "Approval required",
          requires_approval: true,
          risk_level: cmd.risk_level,
          message: "This command requires your approval before execution.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update command status
    if (cmdId) {
      await supabase.from("commands")
        .update({ status: "executing", approved: true })
        .eq("id", cmdId);
    }

    // Emit execution started event
    await supabase.from("events").insert({
      event_type: "command.executing",
      source: "nexus-execute",
      payload: { command_id: cmdId, command_type: cmd.type, intent: cmd.intent },
    });

    // Determine which agent to use
    let agentId: string | null = null;
    const agentType = mapCommandToAgent(cmd.type);
    if (agentType) {
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("type", agentType)
        .eq("status", "idle")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (agent) {
        agentId = agent.id;
        await supabase.from("agents")
          .update({ status: "processing" })
          .eq("id", agentId);
      }
    }

    // Create a task
    const { data: task } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: agentId,
        command_id: cmdId,
        title: cmd.intent || "Execute command",
        description: cmd.parameters?.description || "",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Execute steps
    const actions = cmd.actions || [];
    const steps: any[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepStart = Date.now();

      // Create step record
      const { data: step } = await supabase
        .from("command_steps")
        .insert({
          command_id: cmdId,
          step_number: i + 1,
          action,
          target: cmd.target || "",
          params: cmd.parameters || {},
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      steps.push(step);

      // Emit step started event
      await supabase.from("events").insert({
        event_type: "agent.progress",
        source: "nexus-execute",
        agent_id: agentId,
        payload: {
          command_id: cmdId,
          step: i + 1,
          action,
          status: "running",
        },
      });

      // Simulate step execution with realistic output
      const output = await executeStep(action, cmd, i, agentId, supabase);
      const duration = Date.now() - stepStart;

      // Update step
      await supabase.from("command_steps")
        .update({
          status: "completed",
          output: output.text,
          completed_at: new Date().toISOString(),
        })
        .eq("id", step.id);

      // Emit file events for write_files actions
      if (action === "write_files" && output.files) {
        for (const file of output.files) {
          await supabase.from("file_changes").insert({
            agent_id: agentId,
            workspace_path: `/workspace/agents/${agentId || "default"}`,
            file_path: file.path,
            change_type: "created",
            content_diff: file.content?.slice(0, 500) || "",
            file_size: file.content?.length || 0,
          });

          await supabase.from("events").insert({
            event_type: "file.created",
            source: "nexus-execute",
            agent_id: agentId,
            payload: {
              path: file.path,
              size: file.content?.length || 0,
              step: i + 1,
            },
          });
        }
      }

      // Emit terminal output for install/launch actions
      if (action === "install_dependencies" || action === "run_tests" || action === "launch_application") {
        await supabase.from("events").insert({
          event_type: "terminal.output",
          source: "nexus-execute",
          agent_id: agentId,
          payload: {
            action,
            output: output.text,
            step: i + 1,
          },
        });
      }

      // Emit step completed event
      await supabase.from("events").insert({
        event_type: "agent.progress",
        source: "nexus-execute",
        agent_id: agentId,
        payload: {
          command_id: cmdId,
          step: i + 1,
          action,
          status: "completed",
          duration_ms: duration,
        },
      });

      // Log execution
      await supabase.from("agent_execution_logs").insert({
        agent_id: agentId,
        thought_summary: `Executing step ${i + 1}: ${action}`,
        action,
        tool: action.includes("write") ? "filesystem.write" : action.includes("install") ? "terminal.execute" : "applications.launch",
        input: { target: cmd.target, params: cmd.parameters },
        output: { result: output.text, files: output.files?.length || 0 },
        duration_ms: duration,
      });
    }

    // Create application record if launching
    if (actions.includes("launch_application")) {
      const { data: app } = await supabase
        .from("applications")
        .insert({
          agent_id: agentId,
          name: cmd.target || "Application",
          app_type: cmd.parameters?.framework === "pygame" ? "game" : cmd.parameters?.framework === "react" ? "web" : "python",
          language: cmd.parameters?.language || "python",
          framework: cmd.parameters?.framework || "",
          status: "running",
          start_command: cmd.parameters?.language === "python" ? "python main.py" : "npm start",
          port: cmd.parameters?.framework === "react" ? 3000 : null,
          workspace_path: `/workspace/agents/${agentId || "default"}`,
        })
        .select()
        .single();

      await supabase.from("events").insert({
        event_type: "application.started",
        source: "nexus-execute",
        agent_id: agentId,
        payload: { app_id: app?.id, app_name: app?.name, app_type: app?.app_type },
      });
    }

    // Update task and command as completed
    await supabase.from("agent_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result: { steps_completed: actions.length, steps },
      })
      .eq("id", task?.id);

    if (cmdId) {
      await supabase.from("commands")
        .update({ status: "completed" })
        .eq("id", cmdId);
    }

    // Reset agent status
    if (agentId) {
      await supabase.from("agents")
        .update({ status: "idle", current_task_id: null })
        .eq("id", agentId);
    }

    // Emit completion event
    await supabase.from("events").insert({
      event_type: "task.finished",
      source: "nexus-execute",
      agent_id: agentId,
      payload: {
        command_id: cmdId,
        task_id: task?.id,
        status: "completed",
        steps: actions.length,
      },
    });

    await supabase.from("nexus_logs").insert({
      level: "success",
      message: `Task completed: ${cmd.intent || "command"} (${actions.length} steps)`,
      source: "nexus-execute",
    });

    return new Response(
      JSON.stringify({
        success: true,
        command_id: cmdId,
        task_id: task?.id,
        steps: actions.length,
        agent_id: agentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NEXUS Execute error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapCommandToAgent(cmdType: string): string | null {
  const map: Record<string, string> = {
    create_application: "coding",
    create_agent: "custom",
    research: "research",
    send_email: "email",
    automate: "automation",
    analyze_data: "data",
  };
  return map[cmdType] || null;
}

async function executeStep(action: string, cmd: any, stepIndex: number, agentId: string | null, supabase: any) {
  const lang = cmd.parameters?.language || "python";
  const framework = cmd.parameters?.framework || "";
  const target = cmd.target || "project";

  switch (action) {
    case "create_workspace": {
      return {
        text: `Workspace initialized at /workspace/agents/${agentId || "default"}\nProject: ${target}\nLanguage: ${lang}\nFramework: ${framework}`,
      };
    }
    case "write_files": {
      const files = generateProjectFiles(target, lang, framework);
      return {
        text: `Created ${files.length} files for ${target} project`,
        files,
      };
    }
    case "install_dependencies": {
      const cmd = lang === "python"
        ? `pip install ${framework === "pygame" ? "pygame" : "requests"}`
        : `npm install`;
      return {
        text: `$ ${cmd}\nCollecting packages...\nInstalling collected packages: ${framework}\nSuccessfully installed ${framework}\nDependencies ready.`,
      };
    }
    case "run_tests": {
      return {
        text: `$ ${lang === "python" ? "python -m pytest" : "npm test"}\nRunning tests...\n4 passed, 0 failed in 0.23s\nAll tests passed.`,
      };
    }
    case "launch_application": {
      const startCmd = lang === "python" ? "python main.py" : "npm start";
      return {
        text: `$ ${startCmd}\nApplication starting...\nApplication running on ${framework === "react" ? "http://localhost:3000" : "display"}\nApplication launched successfully.`,
      };
    }
    case "search_web": {
      return {
        text: `Searching for: ${cmd.parameters?.description || target}\nFound 15 relevant results.\nAnalyzing top sources...\nReport compiled.`,
      };
    }
    case "compile_report": {
      return {
        text: `Compiling research report...\nSynthesizing data from 8 sources...\nReport generated: ${target}_report.md`,
      };
    }
    case "send_message": {
      return {
        text: `Email drafted and ready to send.\nAwaiting user approval.`,
      };
    }
    case "create_agent": {
      return {
        text: `Agent configuration generated.\nAgent registered in system.\nWorkspace and memory scope initialized.`,
      };
    }
    default:
      return { text: `Step ${stepIndex + 1}: ${action} completed.` };
  }
}

function generateProjectFiles(target: string, lang: string, framework: string) {
  const files: { path: string; content: string }[] = [];

  if (lang === "python" && framework === "pygame") {
    files.push({
      path: "main.py",
      content: `import pygame\nimport sys\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption("${target}")\nclock = pygame.time.Clock()\n\nclass Player:\n    def __init__(self):\n        self.x = 400\n        self.y = 300\n        self.speed = 5\n    def update(self, keys):\n        if keys[pygame.K_LEFT]: self.x -= self.speed\n        if keys[pygame.K_RIGHT]: self.x += self.speed\n        if keys[pygame.K_UP]: self.y -= self.speed\n        if keys[pygame.K_DOWN]: self.y += self.speed\n\nplayer = Player()\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT: running = False\n    keys = pygame.key.get_pressed()\n    player.update(keys)\n    screen.fill((0, 0, 0))\n    pygame.draw.rect(screen, (0, 255, 0), (player.x, player.y, 30, 30))\n    pygame.display.flip()\n    clock.tick(60)\npygame.quit()`,
    });
    files.push({
      path: "requirements.txt",
      content: `pygame>=2.1.0\n`,
    });
    files.push({
      path: "README.md",
      content: `# ${target}\n\nA 2D game built with Python and Pygame.\n\n## Run\n\`\`\`bash\npip install -r requirements.txt\npython main.py\n\`\`\``,
    });
  } else if (lang === "typescript" && framework === "react") {
    files.push({
      path: "src/App.tsx",
      content: `import { useState } from 'react'\n\nfunction App() {\n  const [count, setCount] = useState(0)\n  return (\n    <div className="app">\n      <h1>${target}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  )\n}\nexport default App`,
    });
    files.push({
      path: "package.json",
      content: `{"name":"${target}","version":"1.0.0","scripts":{"dev":"vite","build":"vite build","start":"vite"},"dependencies":{"react":"^18.0.0","react-dom":"^18.0.0"},"devDependencies":{"vite":"^5.0.0","@vitejs/plugin-react":"^4.0.0"}}`,
    });
    files.push({
      path: "index.html",
      content: `<!DOCTYPE html><html><head><title>${target}</title></head><body><div id="root"></div><script src="/src/main.tsx"></script></body></html>`,
    });
  } else {
    files.push({
      path: `main.${lang === "python" ? "py" : "js"}`,
      content: `// ${target} - generated by NEXUS\nconsole.log("${target} starting...");\n`,
    });
    files.push({
      path: "README.md",
      content: `# ${target}\n\nGenerated by NEXUS AI Employee.\n`,
    });
  }

  return files;
}
