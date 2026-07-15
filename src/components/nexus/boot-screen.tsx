import { useEffect, useState } from "react"
import { NexusOrb } from "@/components/nexus/orb"
import { ScanLine } from "@/components/nexus/effects"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const BOOT_LINES = [
  "Initializing NEXUS core...",
  "Loading neural pathways...",
  "Calibrating cognitive matrices...",
  "Establishing secure uplink...",
  "Mounting memory banks: 2.4TB...",
  "Activating speech synthesis...",
  "Synchronizing subsystems...",
  "Running diagnostics...",
  "All systems nominal.",
  "NEXUS is online.",
]

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let lineIdx = 0
    const lineInterval = setInterval(() => {
      if (lineIdx < BOOT_LINES.length) {
        setLines((prev) => [...prev, BOOT_LINES[lineIdx]])
        setProgress(Math.round(((lineIdx + 1) / BOOT_LINES.length) * 100))
        lineIdx++
      } else {
        clearInterval(lineInterval)
        setDone(true)
        setTimeout(onComplete, 1200)
      }
    }, 350)
    return () => clearInterval(lineInterval)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
      <ScanLine />
      <div className="nexus-grid-animated absolute inset-0 opacity-20" />

      {/* Orb */}
      <div className="relative mb-12 animate-nexus-fade-scale">
        <NexusOrb size={180} />
      </div>

      {/* Name */}
      <h1
        className={cn(
          "text-5xl font-extrabold tracking-[0.4em] text-nexus nexus-text-glow mb-2",
          "animate-nexus-fade-up"
        )}
        style={{ animationDelay: "0.3s" }}
      >
        NEXUS
      </h1>
      <p
        className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-12 animate-nexus-fade-up"
        style={{ animationDelay: "0.5s" }}
      >
        AI Employee Interface v2.4
      </p>

      {/* Boot log */}
      <div className="w-full max-w-md px-8 font-mono text-sm space-y-1 min-h-[260px]">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex items-center gap-2 animate-nexus-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span className="text-nexus/60">{"›"}</span>
            <span
              className={
                i === BOOT_LINES.length - 1
                  ? "text-nexus nexus-text-glow font-semibold"
                  : "text-muted-foreground"
              }
            >
              {line}
            </span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="w-full max-w-md px-8 mt-8 space-y-2">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>SYSTEM INITIALIZATION</span>
          <span className={done ? "text-nexus" : ""}>{progress}%</span>
        </div>
        <Progress
          value={progress}
          className="h-1 bg-nexus/10 [&>div]:bg-nexus [&>div]:shadow-[0_0_8px_var(--nexus-glow)]"
        />
      </div>

      {/* Skip */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground/50 hover:text-nexus transition-colors uppercase tracking-wider"
      >
        Skip Intro ›
      </button>
    </div>
  )
}
