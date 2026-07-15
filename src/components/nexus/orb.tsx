import { cn } from "@/lib/utils"

export function NexusOrb({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg className="absolute inset-0 animate-nexus-spin-slow" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="48" stroke="var(--nexus)" strokeWidth="0.5" strokeDasharray="4 2 8 2 12 2" opacity="0.6" />
      </svg>
      <svg className="absolute inset-2 animate-nexus-spin-reverse" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" stroke="var(--nexus)" strokeWidth="0.3" strokeDasharray="20 5 5 5" opacity="0.4" />
      </svg>
      <svg className="absolute inset-4 animate-nexus-spin-slow" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="42" stroke="var(--nexus)" strokeWidth="0.2" strokeDasharray="2 3" opacity="0.3" />
      </svg>
      <div className="absolute inset-0 rounded-full border border-nexus/30 animate-nexus-pulse-ring" />
      <div className="absolute inset-0 rounded-full border border-nexus/20 animate-nexus-pulse-ring" style={{ animationDelay: "1s" }} />
      <div
        className="relative rounded-full animate-nexus-pulse"
        style={{
          width: size * 0.4, height: size * 0.4,
          background: "radial-gradient(circle, var(--nexus) 0%, var(--nexus-glow) 50%, transparent 100%)",
          boxShadow: "0 0 20px var(--nexus-glow), 0 0 40px var(--nexus-glow)",
        }}
      />
      <div className="absolute rounded-full bg-nexus" style={{ width: 8, height: 8, boxShadow: "0 0 12px var(--nexus), 0 0 24px var(--nexus)" }} />
    </div>
  )
}
