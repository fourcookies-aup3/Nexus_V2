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
    const { action, memoryType, data, query, agentId, taskId } = body;

    switch (action) {
      case "store_semantic": {
        // Store a semantic memory with embedding
        const { content, metadata } = data;
        const embedding = await generateEmbedding(content);

        const { data: record, error } = await supabase
          .from("memory_semantic")
          .insert({
            content,
            embedding,
            metadata: metadata || {},
            agent_id: agentId || null,
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from("events").insert({
          event_type: "memory.stored",
          source: "nexus-memory",
          agent_id: agentId || null,
          payload: { memory_type: "semantic", id: record.id },
        });

        return new Response(
          JSON.stringify({ success: true, id: record.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "search_semantic": {
        // Vector similarity search
        const embedding = await generateEmbedding(query);
        const { data: results, error } = await supabase.rpc("match_semantic_memory", {
          query_embedding: embedding,
          match_count: data?.limit || 10,
        });

        if (error) {
          // Fallback to text search if RPC not available
          const { data: textResults, error: textError } = await supabase
            .from("memory_semantic")
            .select("*")
            .ilike("content", `%${query}%`)
            .limit(data?.limit || 10);
          if (textError) throw textError;
          return new Response(
            JSON.stringify({ results: textResults }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "store_episodic": {
        const { event_type, description, context } = data;
        const { data: record, error } = await supabase
          .from("memory_episodic")
          .insert({
            event_type,
            description,
            context: context || {},
            agent_id: agentId || null,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, id: record.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_episodic": {
        let q = supabase.from("memory_episodic").select("*").order("created_at", { ascending: false });
        if (agentId) q = q.eq("agent_id", agentId);
        if (data?.event_type) q = q.eq("event_type", data.event_type);
        const { data: results, error } = await q.limit(data?.limit || 50);
        if (error) throw error;

        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "store_procedural": {
        const { procedure_name, steps, trigger_conditions } = data;
        const { data: record, error } = await supabase
          .from("memory_procedural")
          .insert({
            procedure_name,
            steps,
            trigger_conditions: trigger_conditions || "",
            agent_id: agentId || null,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, id: record.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_procedural": {
        // Update success rate after execution
        const { id, success } = data;
        const { data: proc } = await supabase
          .from("memory_procedural")
          .select("success_rate, times_executed")
          .eq("id", id)
          .single();

        if (proc) {
          const newCount = proc.times_executed + 1;
          const newRate = ((proc.success_rate * proc.times_executed) + (success ? 1 : 0)) / newCount;
          await supabase.from("memory_procedural")
            .update({ success_rate: newRate, times_executed: newCount })
            .eq("id", id);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_preference": {
        const { data: pref, error } = await supabase
          .from("memory_preferences")
          .select("*")
          .eq("preference_key", data.key)
          .maybeSingle();

        if (error) throw error;

        return new Response(
          JSON.stringify({ preference: pref }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set_preference": {
        const { key, value, category } = data;
        const { error } = await supabase
          .from("memory_preferences")
          .upsert({
            preference_key: key,
            preference_value: value,
            category: category || "general",
          }, { onConflict: "preference_key" });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_all_preferences": {
        const { data: prefs, error } = await supabase
          .from("memory_preferences")
          .select("*")
          .order("category", { ascending: true });

        if (error) throw error;

        return new Response(
          JSON.stringify({ preferences: prefs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "store_working": {
        const { context } = data;
        const { data: record, error } = await supabase
          .from("memory_working")
          .insert({
            agent_id: agentId || null,
            task_id: taskId || null,
            context,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, id: record.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_working": {
        let q = supabase.from("memory_working")
          .select("*")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });
        if (agentId) q = q.eq("agent_id", agentId);
        if (taskId) q = q.eq("task_id", taskId);
        const { data: results, error } = await q.limit(20);
        if (error) throw error;

        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "store_entity": {
        const { name, entity_type, attributes, relationships } = data;
        const { data: record, error } = await supabase
          .from("entities")
          .upsert({
            name,
            entity_type: entity_type || "person",
            attributes: attributes || {},
            relationships: relationships || [],
          }, { onConflict: "name" })
          .select()
          .single();

        if (error) throw error;

        await supabase.from("events").insert({
          event_type: "entity.stored",
          source: "nexus-memory",
          payload: { entity_id: record.id, name, entity_type },
        });

        return new Response(
          JSON.stringify({ success: true, entity: record }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "search_entities": {
        let q = supabase.from("entities").select("*");
        if (query) {
          q = q.ilike("name", `%${query}%`);
        }
        if (data?.entity_type) {
          q = q.eq("entity_type", data.entity_type);
        }
        const { data: results, error } = await q.order("created_at", { ascending: false }).limit(50);
        if (error) throw error;

        return new Response(
          JSON.stringify({ entities: results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_all_memory": {
        // Get a summary of all memory types
        const [semantic, episodic, procedural, preferences, working, entities] = await Promise.all([
          supabase.from("memory_semantic").select("id, content, created_at").order("created_at", { ascending: false }).limit(20),
          supabase.from("memory_episodic").select("*").order("created_at", { ascending: false }).limit(20),
          supabase.from("memory_procedural").select("*").order("created_at", { ascending: false }).limit(20),
          supabase.from("memory_preferences").select("*").order("category", { ascending: true }),
          supabase.from("memory_working").select("*").gt("expires_at", new Date().toISOString()).limit(10),
          supabase.from("entities").select("*").order("created_at", { ascending: false }).limit(20),
        ]);

        return new Response(
          JSON.stringify({
            semantic: semantic.data,
            episodic: episodic.data,
            procedural: procedural.data,
            preferences: preferences.data,
            working: working.data,
            entities: entities.data,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("NEXUS Memory error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Generate a simple hash-based pseudo-embedding (1536 dimensions)
// In production, this would call an embedding API
async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = new Array(1536).fill(0);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  for (let i = 0; i < bytes.length; i++) {
    embedding[i % 1536] = (embedding[i % 1536] + bytes[i] / 255) / 2;
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map(v => v / norm);
}
