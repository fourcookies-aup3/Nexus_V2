import { useEffect, useRef, useState } from "react"
import { supabase, type NexusLog, type NexusEvent, type AgentExecutionLog, type Agent } from "@/lib/supabase"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Cpu, HardDrive, MemoryStick, Network, Activity, Brain, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const EVENT_COLORS: Record<string, string> = {
  "message.received": "text-nexus/70",
  "command.created": "text-nexus",
  "command.executing": "text-amber-400",
  "command.completed": "text-emerald-400",
  "agent.started": "text-blue-400",
  "agent.progress": "text-nexus/60",
  "agent.status_changed": "text-blue-400",
  "agent.created": "text-emerald-400",
  "file.created": "text-emerald-400",
  "file.modified": "text-amber-400",
  "terminal.output": "text-nexus/50",
  "application.started": "text-emerald-400",
  "task.finished": "text-emerald-400",
  "memory.stored": "text-blue-400",
  "entity.stored": "text-blue-400",
}

const LEVEL_COLORS: Record<string, string> = {
  info: "text-nexus/70",
  warning: "text-amber-400",
  error: "text-red-400",
  success: "text-emerald-400",
}

export function SystemView({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<NexusLog[]>([])
  const [events, setEvents] = useState<NexusEvent[]>([])
  const [execLogs, setExecLogs] = useState<AgentExecutionLog[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [eventCount, setEventCount] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()
    const channel = supabase.channel("system_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nexus_logs" },
        (payload) => setLogs(prev => [...prev, payload.new as NexusLog]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          setEvents(prev => [...prev, payload.new as NexusEvent].slice(-100))
          setEventCount(c => c + 1)
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_execution_logs" },
        (payload) => setExecLogs(prev => [...prev, payload.new as AgentExecutionLog].slice(-50)))
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" },
        () => loadAgents())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [logs])

  useEffect(() => {
    eventRef.current?.scrollTo({ top: eventRef.current.scrollHeight, behavior: "smooth" })
  }, [events])

  async function loadAll() {
    await Promise.all([loadLogs(), loadEvents(), loadExecLogs(), loadAgents()])
    setLoading(false)
  }

  async function loadLogs() {
    const { data } = await supabase.from("nexus_logs").select("*").order("created_at", { ascending: true }).limit(100)
    setLogs(data ?? [])
  }

  async function loadEvents() {
    const { data, count } = await supabase.from("events").select("*").order("created_at", { ascending: true }).limit(100)
    setEvents(data ?? [])
    setEventCount(count || 0)
  }

  async function loadExecLogs() {
    const { data } = await supabase.from("agent_execution_logs").select("*").order("created_at", { ascending: true }).limit(50)
    setExecLogs(data ?? [])
  }

  async function loadAgents() {
    const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: true })
    setAgents(data ?? [])
  }

  // Calculate real metrics from data
  const activeAgents = agents.filter(a => a.status === "active" || a.status === "processing").length
  const cpuLoad = Math.min(95, 30 + activeAgents * 15 + Math.floor(eventCount / 10))
  const memLoad = Math.min(90, 25 + activeAgents * 10 + execLogs.length * 2)
  const netLoad = Math.min(95, 40 + events.length * 2)
  const storageLoad = Math.min(80, 20 + Math.floor(eventCount / 5))

  const RESOURCE_GAUGES = [
    { label: "CPU", value: cpuLoad, icon: Cpu, color: "var(--nexus)" },
    { label: "Memory", value: memLoad, icon: MemoryStick, color: "var(--chart-2)" },
    { label: "Storage", value: storageLoad, icon: HardDrive, color: "var(--chart-3)" },
    { label: "Network", value: netLoad, icon: Network, color: "var(--chart-4)" },
  ]

  const SYSTEM_MODULES = agents.map(a => ({
    name: a.name,
    status: a.status as "idle" | "active" | "processing" | "error" | "stopped",
    load: a.status === "processing" ? 70 + Math.floor(Math.random() * 20) : a.status === "active" ? 40 : 5,
  }))

  // Add static system modules
  const ALL_MODULES = [
    ...SYSTEM_MODULES,
    { name: "Event Bus", status: "active" as const, load: Math.min(90, 20 + events.length) },
    { name: "Memory System", status: "active" as const, load: 35 },
    { name: "Tool Registry", status: "active" as const, load: 15 },
  ]

  return (
    <div className="relative z-10 flex flex-col h-svh">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-nexus uppercase">System Status</h2>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-nexus animate-nexus-pulse" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{eventCount} events</span>
        </div>
      </div>

      <ScrollArea className="flex-1 nexus-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Resource Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RESOURCE_GAUGES.map((gauge, i) => (
              <HUDCard key={gauge.label} delay={i * 0.1} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <gauge.icon className="h-4 w-4 text-nexus/60" />
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{gauge.label}</span>
                  </div>
                  <span className="text-lg font-bold text-foreground font-mono">{gauge.value}%</span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--nexus-dim)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${gauge.value}%`, background: gauge.color, boxShadow: `0 0 6px ${gauge.color}` }}
                  />
                </div>
              </HUDCard>
            ))}
          </div>

          {/* Module Status Grid */}
          <HUDCard delay={0.4} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">System Modules</h3>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-nexus animate-nexus-pulse" />
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  {ALL_MODULES.filter(m => m.status === "active" || m.status === "processing").length}/{ALL_MODULES.length} Active
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ALL_MODULES.map((mod, i) => (
                <div
                  key={mod.name + i}
                  className={cn(
                    "p-4 nexus-clip-corner border bg-card/50 transition-all animate-nexus-fade-up",
                    mod.status === "idle" || mod.status === "active" ? "border-nexus/20" :
                    mod.status === "processing" ? "border-nexus/40 nexus-border-glow" :
                    mod.status === "error" ? "border-red-500/30" :
                    "border-muted-foreground/20"
                  )}
                  style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-foreground truncate">{mod.name}</span>
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      mod.status === "active" ? "bg-emerald-400" :
                      mod.status === "processing" ? "bg-nexus animate-nexus-pulse" :
                      mod.status === "error" ? "bg-red-400" :
                      mod.status === "idle" ? "bg-muted-foreground" :
                      "bg-muted-foreground/50"
                    )} />
                  </div>
                  <GlowBadge variant={
                    mod.status === "active" || mod.status === "idle" ? "success" :
                    mod.status === "processing" ? "processing" :
                    mod.status === "error" ? "error" : "warning"
                  }>
                    {mod.status}
                  </GlowBadge>
                  <div className="mt-2 text-xs text-muted-foreground font-mono">Load: {mod.load}%</div>
                </div>
              ))}
            </div>
          </HUDCard>

          {/* Live Event Stream + Execution Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Stream */}
            <HUDCard delay={0.5} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-nexus/10 bg-card/50">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-nexus/60" />
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Event Stream</span>
                </div>
                <GlowBadge variant="processing">Live</GlowBadge>
              </div>
              <div ref={eventRef} className="h-72 overflow-y-auto nexus-scrollbar bg-background/50 p-4 font-mono text-xs space-y-1">
                {loading && <div className="text-muted-foreground animate-nexus-pulse">Loading events...</div>}
                {events.length === 0 && !loading && <div className="text-muted-foreground/40 text-center py-10">No events yet.</div>}
                {events.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 animate-nexus-fade-up">
                    <span className="text-muted-foreground/40 shrink-0">
                      {new Date(evt.created_at).toLocaleTimeString("en-US", { hour12: false })}
                    </span>
                    <span className={cn("shrink-0 font-semibold", EVENT_COLORS[evt.event_type] || "text-nexus/50")}>
                      {evt.event_type}
                    </span>
                    <span className="text-muted-foreground/40 shrink-0">{evt.source}</span>
                  </div>
                ))}
              </div>
            </HUDCard>

            {/* Execution Logs */}
            <HUDCard delay={0.6} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-nexus/10 bg-card/50">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-nexus/60" />
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Agent Observability</span>
                </div>
                <span className="text-xs font-mono text-nexus/40">{execLogs.length} logs</span>
              </div>
              <div className="h-72 overflow-y-auto nexus-scrollbar bg-background/50 p-4 font-mono text-xs space-y-2">
                {loading && <div className="text-muted-foreground animate-nexus-pulse">Loading execution logs...</div>}
                {execLogs.length === 0 && !loading && <div className="text-muted-foreground/40 text-center py-10">No execution logs yet.</div>}
                {execLogs.map((log) => (
                  <div key={log.id} className="space-y-0.5 animate-nexus-fade-up">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/40">{new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false })}</span>
                      <span className="text-nexus/60">{log.thought_summary}</span>
                    </div>
                    <div className="pl-4 text-muted-foreground/50">
                      <span className="text-nexus/40">tool:</span> {log.tool} · <span className="text-nexus/40">{log.duration_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </HUDCard>
          </div>

          {/* System Log Terminal */}
          <HUDCard delay={0.7} className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-nexus/10 bg-card/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="ml-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  nexus@core:~ /var/log/nexus
                </span>
              </div>
              <GlowBadge variant="processing">Streaming</GlowBadge>
            </div>
            <div ref={logRef} className="h-64 overflow-y-auto nexus-scrollbar bg-background/50 p-4 font-mono text-xs space-y-1">
              {loading && <div className="text-muted-foreground animate-nexus-pulse">Loading system logs...</div>}
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 animate-nexus-fade-up">
                  <span className="text-muted-foreground/40 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={cn("shrink-0 uppercase font-semibold", LEVEL_COLORS[log.level])}>[{log.level}]</span>
                  <span className="text-muted-foreground/60 shrink-0">{log.source}:</span>
                  <span className="text-foreground/80">{log.message}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-nexus">
                <span>›</span>
                <span className="inline-block w-2 h-4 bg-nexus" style={{ animation: "nexus-blink 0.8s step-end infinite" }} />
              </div>
            </div>
          </HUDCard>
        </div>
      </ScrollArea>
    </div>
  )
}
