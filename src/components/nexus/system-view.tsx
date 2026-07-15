import { useEffect, useRef, useState } from "react"
import { supabase, type NexusLog } from "@/lib/supabase"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Cpu, HardDrive, MemoryStick, Network, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const SYSTEM_MODULES = [
  { name: "Neural Core", status: "online" as const, load: 67 },
  { name: "Memory Banks", status: "online" as const, load: 42 },
  { name: "Language Engine", status: "online" as const, load: 88 },
  { name: "Data Processor", status: "processing" as const, load: 73 },
  { name: "Security Layer", status: "online" as const, load: 15 },
  { name: "Learning Module", status: "standby" as const, load: 5 },
  { name: "Vision System", status: "online" as const, load: 54 },
  { name: "Speech Synthesis", status: "online" as const, load: 31 },
]

const RESOURCE_GAUGES = [
  { label: "CPU", value: 67, icon: Cpu, color: "var(--nexus)" },
  { label: "Memory", value: 42, icon: MemoryStick, color: "var(--chart-2)" },
  { label: "Storage", value: 28, icon: HardDrive, color: "var(--chart-3)" },
  { label: "Network", value: 91, icon: Network, color: "var(--chart-4)" },
]

const LEVEL_COLORS: Record<string, string> = {
  info: "text-nexus/70",
  warning: "text-amber-400",
  error: "text-red-400",
  success: "text-emerald-400",
}

export function SystemView({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<NexusLog[]>([])
  const [loading, setLoading] = useState(true)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLogs()
    const channel = supabase
      .channel("nexus_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nexus_logs" },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as NexusLog])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" })
  }, [logs])

  async function loadLogs() {
    const { data } = await supabase
      .from("nexus_logs")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100)
    setLogs(data ?? [])
    setLoading(false)
  }

  return (
    <div className="relative z-10 flex flex-col h-svh">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-nexus uppercase">System Status</h2>
        <div className="w-20" />
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
                <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nexus-dim)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
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
                  {SYSTEM_MODULES.filter((m) => m.status === "online").length}/{SYSTEM_MODULES.length} Online
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SYSTEM_MODULES.map((mod, i) => (
                <div
                  key={mod.name}
                  className={cn(
                    "p-4 nexus-clip-corner border bg-card/50 transition-all animate-nexus-fade-up",
                    mod.status === "online"
                      ? "border-nexus/20"
                      : mod.status === "processing"
                        ? "border-nexus/40 nexus-border-glow"
                        : "border-muted-foreground/20"
                  )}
                  style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-foreground">{mod.name}</span>
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        mod.status === "online" ? "bg-emerald-400" : mod.status === "processing" ? "bg-nexus animate-nexus-pulse" : "bg-muted-foreground"
                      )}
                    />
                  </div>
                  <GlowBadge
                    variant={mod.status === "online" ? "success" : mod.status === "processing" ? "processing" : "warning"}
                  >
                    {mod.status}
                  </GlowBadge>
                  <div className="mt-2 text-xs text-muted-foreground font-mono">
                    Load: {mod.load}%
                  </div>
                </div>
              ))}
            </div>
          </HUDCard>

          {/* Terminal Log */}
          <HUDCard delay={0.5} className="p-0 overflow-hidden">
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
            <div
              ref={terminalRef}
              className="h-80 overflow-y-auto nexus-scrollbar bg-background/50 p-4 font-mono text-xs space-y-1"
            >
              {loading && (
                <div className="text-muted-foreground animate-nexus-pulse">Loading system logs...</div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 animate-nexus-fade-up">
                  <span className="text-muted-foreground/40 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={cn("shrink-0 uppercase font-semibold", LEVEL_COLORS[log.level])}>
                    [{log.level}]
                  </span>
                  <span className="text-muted-foreground/60 shrink-0">{log.source}:</span>
                  <span className="text-foreground/80">{log.message}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-nexus">
                <span>{"›"}</span>
                <span className="inline-block w-2 h-4 bg-nexus" style={{ animation: "nexus-blink 0.8s step-end infinite" }} />
              </div>
            </div>
          </HUDCard>
        </div>
      </ScrollArea>
    </div>
  )
}
