import { NexusOrb } from "@/components/nexus/orb"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { MessageSquare, BarChart3, Terminal, Activity, Brain, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

export type NexusView = "dashboard" | "chat" | "analytics" | "system"

const NAV_ITEMS = [
  { id: "chat" as NexusView, label: "Communication", icon: MessageSquare, desc: "Direct interface with Nexus" },
  { id: "analytics" as NexusView, label: "Analytics", icon: BarChart3, desc: "Performance metrics & data" },
  { id: "system" as NexusView, label: "System Status", icon: Terminal, desc: "Core diagnostics & logs" },
]

const STATS = [
  { label: "Uptime", value: "99.97%", icon: Activity },
  { label: "Tasks Processed", value: "14,832", icon: Brain },
  { label: "Response Time", value: "0.3s", icon: Zap },
]

export function Dashboard({ onNavigate }: { onNavigate: (view: NexusView) => void }) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false })

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-svh px-6 py-12">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-nexus-pulse" />
          <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
            Nexus Online
          </span>
        </div>
        <div className="text-xs font-mono tracking-widest text-muted-foreground">
          {timeStr} UTC
        </div>
      </div>

      {/* Central Orb */}
      <div className="relative mb-10">
        <NexusOrb size={220} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center mt-[240px]">
            <h1 className="text-3xl font-extrabold tracking-[0.3em] text-nexus nexus-text-glow">
              NEXUS
            </h1>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase mt-1">
              AI Employee
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4 mb-10 flex-wrap justify-center">
        {STATS.map((stat, i) => (
          <HUDCard key={stat.label} delay={0.3 + i * 0.1} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-nexus/70" />
              <div>
                <div className="text-lg font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            </div>
          </HUDCard>
        ))}
      </div>

      {/* Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group text-left"
          >
            <HUDCard
              delay={0.5 + i * 0.15}
              glow
              className={cn(
                "p-6 transition-all duration-300 group-hover:-translate-y-1",
                "group-hover:nexus-border-glow"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <item.icon className="h-8 w-8 text-nexus group-hover:scale-110 transition-transform" />
                <GlowBadge variant="processing">Active</GlowBadge>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {item.label}
              </h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-mono text-nexus/60 group-hover:text-nexus transition-colors">
                <span>ACCESS</span>
                <span className="group-hover:translate-x-1 transition-transform">›</span>
              </div>
            </HUDCard>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-6">
        <span className="text-xs font-mono text-muted-foreground/40 tracking-wider">
          NEXUS // BUILD 2.4.1
        </span>
        <span className="text-xs font-mono text-muted-foreground/40 tracking-wider">
          SECURE CONNECTION ESTABLISHED
        </span>
      </div>
    </div>
  )
}
