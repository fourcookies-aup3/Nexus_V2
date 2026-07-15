import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function GlowBadge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode
  variant?: "default" | "success" | "warning" | "error" | "processing"
  className?: string
}) {
  const styles = {
    default: "border-nexus/30 text-nexus bg-nexus/5",
    success: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    warning: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    error: "border-red-500/40 text-red-400 bg-red-500/10",
    processing: "border-nexus/40 text-nexus bg-nexus/10 animate-nexus-pulse",
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-xs tracking-wider uppercase", styles[variant], className)}
    >
      {children}
    </Badge>
  )
}
