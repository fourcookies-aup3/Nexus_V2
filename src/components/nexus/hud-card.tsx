import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function HUDCard({
  children,
  className,
  glow = false,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  glow?: boolean
  delay?: number
}) {
  return (
    <div
      className={cn(
        "relative bg-card/80 backdrop-blur-sm nexus-clip-corner border border-nexus/15",
        glow && "nexus-border-glow",
        className
      )}
      style={{ animation: `nexus-fade-up 0.5s ease-out ${delay}s both` }}
    >
      <span className="pointer-events-none absolute -top-px -left-px h-3 w-3 border-t-2 border-l-2 border-nexus" />
      <span className="pointer-events-none absolute -top-px -right-px h-3 w-3 border-t-2 border-r-2 border-nexus" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-nexus" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-nexus" />
      {children}
    </div>
  )
}
