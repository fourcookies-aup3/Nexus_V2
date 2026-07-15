import { useEffect, useState } from "react"

export function ScanLine() {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <div
        className="absolute left-0 right-0 h-px animate-nexus-scan"
        style={{
          background: "linear-gradient(90deg, transparent, var(--nexus), transparent)",
          boxShadow: "0 0 10px var(--nexus-glow)",
        }}
      />
    </div>
  )
}

export function DataStream({ count = 12 }: { count?: number }) {
  const streams = Array.from({ length: count }, (_, i) => i)
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {streams.map((i) => (
        <div
          key={i}
          className="absolute top-0 w-px"
          style={{
            left: `${(i / count) * 100}%`,
            height: `${20 + Math.random() * 40}%`,
            background: "linear-gradient(to bottom, transparent, var(--nexus-dim), transparent)",
            animation: `nexus-data-stream ${4 + Math.random() * 6}s linear ${Math.random() * 5}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

export function GridBackground({ animated = true }: { animated?: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 ${animated ? "nexus-grid-animated" : "nexus-grid-bg"}`}
      style={{ opacity: 0.3 }}
    />
  )
}

export function RadialGlow() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 nexus-radial-bg"
      style={{ opacity: 0.15 }}
    />
  )
}

export function TypewriterText({
  text,
  speed = 30,
  className,
  onDone,
}: {
  text: string
  speed?: number
  className?: string
  onDone?: () => void
}) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setDone(true)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed, onDone])

  return (
    <span className={className}>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-4 bg-nexus ml-0.5 align-middle" style={{ animation: "nexus-blink 0.8s step-end infinite" }} />
      )}
    </span>
  )
}

export function Waveform({ active = true, bars = 24 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="w-0.5 bg-nexus rounded-full"
          style={{
            height: "100%",
            transformOrigin: "center",
            animation: active ? `nexus-wave ${0.5 + (i % 5) * 0.15}s ease-in-out ${i * 0.04}s infinite` : "none",
            opacity: active ? 0.8 : 0.2,
            transform: active ? undefined : "scaleY(0.15)",
          }}
        />
      ))}
    </div>
  )
}
