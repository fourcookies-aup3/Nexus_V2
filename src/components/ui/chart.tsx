import * as React from "react"
import { cn } from "@/lib/utils"

export type ChartConfig = Record<string, {
  label?: React.ReactNode
  icon?: React.ComponentType
  color?: string
  theme?: Record<string, string>
}>

const ChartContext = React.createContext<ChartConfig | null>(null)

export function ChartContainer({
  config,
  children,
  className,
}: {
  config: ChartConfig
  children: React.ReactNode
  className?: string
}) {
  return (
    <ChartContext.Provider value={config}>
      <div className={cn("flex justify-center text-xs", className)}>
        {children}
      </div>
    </ChartContext.Provider>
  )
}

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow-md">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span>{item.name}: {item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ChartTooltipContent(props: any) {
  return <ChartTooltip {...props} />
}

export function ChartLegend({ payload }: any) {
  if (!payload?.length) return null
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {payload.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="text-xs text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ChartLegendContent(props: any) {
  return <ChartLegend {...props} />
}
