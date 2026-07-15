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
