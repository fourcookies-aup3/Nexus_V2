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

const AGENT_TEMPLATES: Record<string, any> = {
  coding: {
    name: "Coding Agent",
    type: "coding",
    system_prompt: "You are a Coding Agent. You create projects, write code, install dependencies, run tests, and launch applications. You work with Python, JavaScript, TypeScript, C++, C#, Java, and HTML/CSS.",
    skills: ["coding", "debugging", "testing", "project_creation", "file_management"],
    tools: ["filesystem.read", "filesystem.write", "terminal.execute", "github.read", "applications.build", "applications.launch"],
    permissions: ["filesystem.read", "filesystem.write", "terminal.execute", "github.read", "applications.build", "applications.launch"],
  },
  game: {
    name: "Game Developer Agent",
    type: "game",
    system_prompt: "You are a Game Developer Agent. You specialize in creating 2D and 3D games using Pygame, Unity, Godot, and web-based game frameworks. You handle game physics, graphics, audio, and player input.",
    skills: ["game_design", "physics", "graphics", "audio", "game_logic", "pygame", "unity"],
    tools: ["filesystem.read", "filesystem.write", "terminal.execute", "applications.build", "applications.launch"],
    permissions: ["filesystem.read", "filesystem.write", "terminal.execute", "applications.build", "applications.launch"],
  },
  research: {
    name: "Research Agent",
    type: "research",
    system_prompt: "You are a Research Agent. You search the web, analyze data, compile reports, and synthesize information from multiple sources.",
    skills: ["research", "analysis", "web_search", "data_synthesis", "report_writing"],
    tools: ["browser.navigate", "browser.automate"],
    permissions: ["browser.navigate", "browser.automate"],
  },
  email: {
    name: "Email Agent",
    type: "email",
    system_prompt: "You are an Email Agent. You read, compose, and send emails. You manage inbox, draft responses, and handle email automation.",
    skills: ["email_composition", "inbox_management", "email_automation", "response_drafting"],
    tools: ["email.read", "email.send"],
    permissions: ["email.read"],
  },
  automation: {
    name: "Automation Agent",
    type: "automation",
    system_prompt: "You are an Automation Agent. You create workflows, trigger n8n pipelines, schedule tasks, and automate repetitive processes.",
    skills: ["workflow_design", "n8n", "scheduling", "task_automation", "integration"],
    tools: ["n8n.trigger", "terminal.execute", "filesystem.read"],
    permissions: ["n8n.trigger", "filesystem.read"],
  },
  data: {
    name: "Data Agent",
    type: "data",
    system_prompt: "You are a Data Agent. You analyze datasets, create visualizations, run statistical models, and generate insights from data.",
    skills: ["data_analysis", "statistics", "visualization", "sql", "python_pandas"],
    tools: ["filesystem.read", "filesystem.write", "terminal.execute"],
    permissions: ["filesystem.read", "filesystem.write", "terminal.execute"],
  },
  web: {
    name: "Web Agent",
    type: "web",
    system_prompt: "You are a Web Agent. You navigate websites, scrape data, fill forms, and interact with web applications.",
    skills: ["web_scraping", "form_filling", "web_navigation", "data_extraction"],
    tools: ["browser.navigate", "browser.automate"],
    permissions: ["browser.navigate", "browser.automate"],
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // GET /nexus-agent — list all agents
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ agents: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /nexus-agent — create or manage agents
    const body = await req.json();
    const { action, agentType, description, agentId, taskId, status } = body;

    // Create a new agent
    if (action === "create") {
      let agentData;

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey && description) {
        // Use Claude to generate a custom agent
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
            system: "You are NEXUS Agent Factory. Generate a JSON object for a new AI agent. Fields: name, type (coding|research|email|automation|data|web|game|custom), system_prompt, skills (array), tools (array of tool names from: filesystem.read, filesystem.write, terminal.execute, github.read, github.write, email.read, email.send, browser.navigate, browser.automate, applications.build, applications.launch, n8n.trigger), permissions (subset of tools). Respond ONLY with JSON.",
            messages: [{ role: "user", content: `Create an agent for: ${description}` }],
          }),
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const text = claudeData.content?.[0]?.text || "";
          try {
            agentData = JSON.parse(text);
          } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            agentData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          }
        }
      }

      // Fallback to template
      if (!agentData) {
        const templateKey = agentType || "coding";
        agentData = AGENT_TEMPLATES[templateKey] || AGENT_TEMPLATES.coding;
      }

      const workspacePath = `/workspace/agents/${crypto.randomUUID()}`;

      const { data: newAgent, error } = await supabase
        .from("agents")
        .insert({
          name: agentData.name || "Custom Agent",
          type: agentData.type || "custom",
          system_prompt: agentData.system_prompt || "",
          skills: agentData.skills || [],
          tools: agentData.tools || [],
          permissions: agentData.permissions || [],
          memory_scope: "isolated",
          workspace_path: workspacePath,
          status: "idle",
        })
        .select()
        .single();

      if (error) throw error;

      // Emit event
      await supabase.from("events").insert({
        event_type: "agent.created",
        source: "nexus-agent",
        agent_id: newAgent.id,
        payload: { agent_name: newAgent.name, agent_type: newAgent.type },
      });

      await supabase.from("nexus_logs").insert({
        level: "success",
        message: `Agent created: ${newAgent.name} (${newAgent.type})`,
        source: "nexus-agent",
      });

      return new Response(
        JSON.stringify({ agent: newAgent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign a task to an agent
    if (action === "assign_task") {
      const { data: task, error } = await supabase
        .from("agent_tasks")
        .insert({
          agent_id: agentId,
          title: body.title || "Untitled Task",
          description: body.description || "",
          status: "queued",
          priority: body.priority || 5,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("agents")
        .update({ status: "active", current_task_id: task.id })
        .eq("id", agentId);

      await supabase.from("events").insert({
        event_type: "agent.started",
        source: "nexus-agent",
        agent_id: agentId,
        payload: { task_id: task.id, title: task.title },
      });

      return new Response(
        JSON.stringify({ task }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update agent status
    if (action === "update_status") {
      const { error } = await supabase
        .from("agents")
        .update({ status })
        .eq("id", agentId);

      if (error) throw error;

      await supabase.from("events").insert({
        event_type: "agent.status_changed",
        source: "nexus-agent",
        agent_id: agentId,
        payload: { status },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent tasks
    if (action === "get_tasks") {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ tasks: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NEXUS Agent error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
