import { useEffect, useState } from "react"
import { supabase, type Agent, type NexusEvent } from "@/lib/supabase"
import { NexusOrb } from "@/components/nexus/orb"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { MessageSquare, ChartBar as BarChart3, Terminal, Activity, Brain, Zap, Users, FolderOpen, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

export type NexusView = "dashboard" | "chat" | "analytics" | "agents" | "workspace" | "system"

const NAV_ITEMS = [
  { id: "chat" as NexusView, label: "Communication", icon: MessageSquare, desc: "Direct interface with Nexus" },
  { id: "agents" as NexusView, label: "Agent Registry", icon: Users, desc: "Create & manage AI agents" },
  { id: "workspace" as NexusView, label: "Workspace", icon: FolderOpen, desc: "Live file tree & terminal" },
  { id: "analytics" as NexusView, label: "Analytics", icon: BarChart3, desc: "Performance metrics & data" },
  { id: "system" as NexusView, label: "System Status", icon: Terminal, desc: "Core diagnostics & logs" },
]

export function Dashboard({ onNavigate }: { onNavigate: (view: NexusView) => void }) {
  const [stats, setStats] = useState({ agents: 0, activeTasks: 0, events: 0, files: 0, apps: 0 })
  const [activeAgents, setActiveAgents] = useState<Agent[]>([])
  const [recentEvents, setRecentEvents] = useState<NexusEvent[]>([])

  useEffect(() => {
    loadStats()
    const channel = supabase.channel("dashboard_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" },
        () => loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" },
        () => loadStats())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_tasks" },
        () => loadStats())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadStats() {
    const [agents, tasks, events, files, apps, active] = await Promise.all([
      supabase.from("agents").select("id, name, type, status, skills", { count: "exact" }),
      supabase.from("agent_tasks").select("id", { count: "exact" }).in("status", ["running", "queued"]),
      supabase.from("events").select("id", { count: "exact" }),
      supabase.from("file_changes").select("id", { count: "exact" }),
      supabase.from("applications").select("id", { count: "exact" }),
      supabase.from("agents").select("*").in("status", ["active", "processing"]),
    ])

    setStats({
      agents: agents.count || 0,
      activeTasks: tasks.count || 0,
      events: events.count || 0,
      files: files.count || 0,
      apps: apps.count || 0,
    })
    setActiveAgents((active.data || []) as Agent[])

    const { data: recentEvts } = await supabase.from("events").select("*").order("created_at", { ascending: false }).limit(5)
    setRecentEvents((recentEvts || []) as NexusEvent[])
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false })

  const STAT_CARDS = [
    { label: "Active Agents", value: stats.agents, icon: Cpu },
    { label: "Running Tasks", value: stats.activeTasks, icon: Activity },
    { label: "Events Processed", value: stats.events, icon: Zap },
    { label: "Files Created", value: stats.files, icon: Brain },
  ]

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-svh px-6 py-12">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-nexus-pulse" />
          <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Nexus Online</span>
        </div>
        <div className="text-xs font-mono tracking-widest text-muted-foreground">{timeStr} UTC</div>
      </div>

      <div className="relative mb-10">
        <NexusOrb size={220} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center mt-[240px]">
            <h1 className="text-3xl font-extrabold tracking-[0.3em] text-nexus nexus-text-glow">NEXUS</h1>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase mt-1">Autonomous AI Employee</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-10 flex-wrap justify-center">
        {STAT_CARDS.map((stat, i) => (
          <HUDCard key={stat.label} delay={0.3 + i * 0.1} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-nexus/70" />
              <div>
                <div className="text-lg font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            </div>
          </HUDCard>
        ))}
      </div>

      {/* Active Agents Strip */}
      {activeAgents.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap justify-center max-w-3xl">
          {activeAgents.map(agent => (
            <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 bg-nexus/5 border border-nexus/15 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-nexus animate-nexus-pulse" />
              <span className="text-xs font-mono text-nexus">{agent.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        {NAV_ITEMS.map((item, i) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className="group text-left">
            <HUDCard
              delay={0.5 + i * 0.1}
              glow
              className={cn("p-6 transition-all duration-300 group-hover:-translate-y-1", "group-hover:nexus-border-glow")}
            >
              <div className="flex items-start justify-between mb-4">
                <item.icon className="h-8 w-8 text-nexus group-hover:scale-110 transition-transform" />
                <GlowBadge variant="processing">Active</GlowBadge>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">{item.label}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-mono text-nexus/60 group-hover:text-nexus transition-colors">
                <span>ACCESS</span>
                <span className="group-hover:translate-x-1 transition-transform">›</span>
              </div>
            </HUDCard>
          </button>
        ))}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="mt-8 w-full max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Activity</div>
          <div className="space-y-1">
            {recentEvents.map(evt => (
              <div key={evt.id} className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                <span className="text-nexus/40">{new Date(evt.created_at).toLocaleTimeString("en-US", { hour12: false })}</span>
                <span className="text-nexus/60">{evt.event_type}</span>
                <span className="truncate">{evt.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-6">
        <span className="text-xs font-mono text-muted-foreground/40 tracking-wider">NEXUS // BUILD 3.0.0</span>
        <span className="text-xs font-mono text-muted-foreground/40 tracking-wider">SECURE CONNECTION ESTABLISHED</span>
      </div>
    </div>
  )
}
