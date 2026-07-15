import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anonKey)

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export type NexusLog = {
  id: string
  level: "info" | "warning" | "error" | "success"
  message: string
  source: string
  created_at: string
}

export type Agent = {
  id: string
  name: string
  type: string
  system_prompt: string
  skills: string[]
  tools: string[]
  permissions: string[]
  memory_scope: string
  workspace_path: string
  status: "idle" | "active" | "processing" | "error" | "stopped"
  current_task_id: string | null
  created_at: string
  updated_at: string
}

export type AgentTask = {
  id: string
  agent_id: string | null
  command_id: string | null
  title: string
  description: string | null
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  priority: number
  result: any
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type Command = {
  id: string
  raw_input: string
  intent: string | null
  command_type: string
  command_payload: NexusCommand
  status: "pending" | "validated" | "executing" | "completed" | "failed" | "cancelled"
  approval_required: boolean
  approved: boolean
  risk_level: "low" | "medium" | "high"
  required_tools: string[]
  agent_id: string | null
  task_id: string | null
  created_at: string
}

export type NexusCommand = {
  type: string
  intent: string
  target: string
  parameters: {
    language?: string
    framework?: string
    description?: string
  }
  actions: string[]
  required_tools: string[]
  risk_level: "low" | "medium" | "high"
  approval_required: boolean
  response: string
}

export type CommandStep = {
  id: string
  command_id: string
  step_number: number
  action: string
  target: string | null
  params: any
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  output: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type NexusEvent = {
  id: string
  event_type: string
  source: string
  payload: any
  agent_id: string | null
  created_at: string
}

export type FileChange = {
  id: string
  agent_id: string | null
  workspace_path: string
  file_path: string
  change_type: "created" | "modified" | "deleted" | "renamed"
  content_diff: string
  file_size: number
  created_at: string
}

export type Application = {
  id: string
  agent_id: string | null
  name: string
  app_type: string
  language: string
  framework: string
  status: "building" | "running" | "stopped" | "error" | "completed"
  start_command: string
  port: number | null
  workspace_path: string
  logs: string
  created_at: string
}

export type AgentExecutionLog = {
  id: string
  agent_id: string | null
  thought_summary: string
  action: string
  tool: string
  input: any
  output: any
  duration_ms: number
  created_at: string
}

export type Job = {
  id: string
  type: string
  payload: any
  priority: number
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  worker: string | null
  retry_count: number
  result: any
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export type Entity = {
  id: string
  name: string
  entity_type: string
  attributes: any
  relationships: any[]
  created_at: string
}

const functionUrl = `${url}/functions/v1`

async function callFunction(name: string, body: any) {
  const response = await fetch(`${functionUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Request failed (${response.status})`)
  }

  return response.json()
}

export const nexusApi = {
  async sendMessage(message: string, conversationHistory?: { role: string; content: string }[]) {
    return callFunction("nexus-core", { message, conversationHistory })
  },

  async executeCommand(commandId: string, command?: NexusCommand, approved?: boolean) {
    return callFunction("nexus-execute", { command_id: commandId, command, approved })
  },

  async getAgents() {
    const response = await fetch(`${functionUrl}/nexus-agent`, {
      headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    })
    if (!response.ok) throw new Error("Failed to fetch agents")
    return response.json()
  },

  async createAgent(agentType: string, description?: string) {
    return callFunction("nexus-agent", { action: "create", agentType, description })
  },

  async assignTask(agentId: string, title: string, description: string) {
    return callFunction("nexus-agent", { action: "assign_task", agentId, title, description })
  },

  async updateAgentStatus(agentId: string, status: string) {
    return callFunction("nexus-agent", { action: "update_status", agentId, status })
  },

  async getAgentTasks(agentId: string) {
    return callFunction("nexus-agent", { action: "get_tasks", agentId })
  },

  async storeMemory(action: string, data: any, agentId?: string) {
    return callFunction("nexus-memory", { action, data, agentId })
  },

  async searchMemory(query: string) {
    return callFunction("nexus-memory", { action: "search_semantic", query })
  },

  async getAllMemory() {
    return callFunction("nexus-memory", { action: "get_all_memory" })
  },
}
