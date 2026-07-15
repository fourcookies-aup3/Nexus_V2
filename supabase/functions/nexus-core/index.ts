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

const SYSTEM_PROMPT = `You are NEXUS, an autonomous AI Employee. You understand natural language and translate it into structured executable commands.

Your job: analyze the user's request and produce a JSON command object.

Command structure:
{
  "type": "create_application" | "create_agent" | "research" | "send_email" | "automate" | "analyze_data" | "general_response" | "create_task",
  "intent": "brief description of what the user wants",
  "target": "what to act on (e.g. 'game', 'website', 'api', 'report')",
  "parameters": {
    "language": "python|javascript|typescript|html|cpp|csharp|java",
    "framework": "pygame|react|nextjs|express|fastapi|none",
    "description": "detailed description of what to build or do"
  },
  "actions": ["step1", "step2", ...],
  "required_tools": ["filesystem.write", "terminal.execute", ...],
  "risk_level": "low|medium|high",
  "approval_required": false,
  "response": "A natural language response to the user explaining what you will do"
}

Action types: create_workspace, write_files, install_dependencies, run_tests, launch_application, search_web, compile_report, send_message, create_agent, schedule_task, analyze_data

For simple questions or conversation, use type "general_response" with no actions.

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the user message
    await supabase.from("messages").insert({
      role: "user",
      content: message,
    });

    // Emit event
    await supabase.from("events").insert({
      event_type: "message.received",
      source: "interface",
      payload: { message },
    });

    // Build conversation context for Claude
    const historyText = (conversationHistory || [])
      .slice(-10)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    const userPrompt = historyText
      ? `Previous conversation:\n${historyText}\n\nNew request: ${message}`
      : `User request: ${message}`;

    // Call Claude API
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let command;

    if (anthropicKey) {
      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!claudeResponse.ok) {
        const errText = await claudeResponse.text();
        console.error("Claude API error:", errText);
        command = fallbackCommand(message);
      } else {
        const claudeData = await claudeResponse.json();
        const text = claudeData.content?.[0]?.text || "";
        try {
          command = JSON.parse(text);
        } catch {
          // Extract JSON from response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          command = jsonMatch ? JSON.parse(jsonMatch[0]) : fallbackCommand(message);
        }
      }
    } else {
      command = fallbackCommand(message);
    }

    // Validate and enrich command
    if (!command.type) command.type = "general_response";
    if (!command.actions) command.actions = [];
    if (!command.required_tools) command.required_tools = [];
    if (!command.risk_level) command.risk_level = "low";
    if (!command.approval_required) command.approval_required = false;
    if (!command.response) command.response = "I've processed your request.";
    if (!command.parameters) command.parameters = {};

    // Determine risk level from required tools
    const highRiskTools = ["terminal.execute", "filesystem.delete", "email.send", "github.write", "docker.run"];
    if (command.required_tools.some((t: string) => highRiskTools.includes(t))) {
      command.risk_level = "high";
      command.approval_required = true;
    }

    // Store the command
    const { data: commandRecord, error: cmdError } = await supabase
      .from("commands")
      .insert({
        raw_input: message,
        intent: command.intent || "",
        command_type: command.type,
        command_payload: command,
        status: "validated",
        approval_required: command.approval_required,
        approved: !command.approval_required,
        risk_level: command.risk_level,
        required_tools: command.required_tools,
      })
      .select()
      .single();

    if (cmdError) console.error("Command storage error:", cmdError);

    // Store assistant response message
    await supabase.from("messages").insert({
      role: "assistant",
      content: command.response,
    });

    // Emit command created event
    await supabase.from("events").insert({
      event_type: "command.created",
      source: "nexus-core",
      payload: {
        command_id: commandRecord?.id,
        command_type: command.type,
        intent: command.intent,
      },
    });

    // Log to nexus_logs
    await supabase.from("nexus_logs").insert({
      level: "info",
      message: `Command generated: ${command.type} — ${command.intent || message.slice(0, 50)}`,
      source: "nexus-core",
    });

    return new Response(
      JSON.stringify({
        command,
        command_id: commandRecord?.id,
        message_id: commandRecord?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NEXUS Core error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function fallbackCommand(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("game") || lower.includes("spiel")) {
    return {
      type: "create_application",
      intent: "Build a 2D game",
      target: "game",
      parameters: {
        language: "python",
        framework: "pygame",
        description: "A 2D game with player movement, collision detection, and score tracking",
      },
      actions: ["create_workspace", "write_files", "install_dependencies", "run_tests", "launch_application"],
      required_tools: ["filesystem.write", "terminal.execute", "applications.build", "applications.launch"],
      risk_level: "medium",
      approval_required: false,
      response: "I'll build a 2D game using Python and Pygame. I'll create the project structure, write the game code, install dependencies, run tests, and launch the game for you.",
    };
  }

  if (lower.includes("website") || lower.includes("web") || lower.includes("seite")) {
    return {
      type: "create_application",
      intent: "Build a website",
      target: "website",
      parameters: {
        language: "typescript",
        framework: "react",
        description: "A modern responsive website with React",
      },
      actions: ["create_workspace", "write_files", "install_dependencies", "run_tests", "launch_application"],
      required_tools: ["filesystem.write", "terminal.execute", "applications.build", "applications.launch"],
      risk_level: "medium",
      approval_required: false,
      response: "I'll build a modern React website. I'll set up the project, create the components, install dependencies, and launch the dev server.",
    };
  }

  if (lower.includes("agent") || lower.includes("create") && lower.includes("developer")) {
    return {
      type: "create_agent",
      intent: "Create a new specialized agent",
      target: "agent",
      parameters: {
        description: message,
      },
      actions: ["create_agent"],
      required_tools: [],
      risk_level: "low",
      approval_required: false,
      response: "I'll create a new specialized agent for you. Let me configure its skills, tools, and permissions.",
    };
  }

  if (lower.includes("email") || lower.includes("mail")) {
    return {
      type: "send_email",
      intent: "Send an email",
      target: "email",
      parameters: {
        description: message,
      },
      actions: ["send_message"],
      required_tools: ["email.send"],
      risk_level: "high",
      approval_required: true,
      response: "I can help send that email. This action requires your approval since it's an external communication.",
    };
  }

  if (lower.includes("research") || lower.includes("search") || lower.includes("find")) {
    return {
      type: "research",
      intent: "Research a topic",
      target: "information",
      parameters: {
        description: message,
      },
      actions: ["search_web", "compile_report"],
      required_tools: ["browser.navigate", "browser.automate"],
      risk_level: "low",
      approval_required: false,
      response: "I'll research that topic for you. I'll search the web, analyze the results, and compile a report.",
    };
  }

  return {
    type: "general_response",
    intent: "Respond to user message",
    target: "conversation",
    parameters: {},
    actions: [],
    required_tools: [],
    risk_level: "low",
    approval_required: false,
    response: `I understand you want: "${message}". I can help with creating applications, building games, writing code, researching topics, sending emails, creating agents, and automating tasks. What would you like me to do?`,
  };
}
