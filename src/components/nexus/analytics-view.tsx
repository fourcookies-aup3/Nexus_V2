import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, TrendingUp, TrendingDown, Cpu, Brain, Zap, CheckCircle } from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

const activityData = [
  { time: "00:00", tasks: 12, queries: 45 },
  { time: "04:00", tasks: 8, queries: 32 },
  { time: "08:00", tasks: 24, queries: 78 },
  { time: "12:00", tasks: 31, queries: 95 },
  { time: "16:00", tasks: 28, queries: 88 },
  { time: "20:00", tasks: 19, queries: 62 },
  { time: "24:00", tasks: 14, queries: 50 },
]

const capabilityData = [
  { capability: "Analysis", value: 92 },
  { capability: "Speed", value: 88 },
  { capability: "Accuracy", value: 96 },
  { capability: "Learning", value: 84 },
  { capability: "Reasoning", value: 90 },
  { capability: "Language", value: 94 },
]

const taskData = [
  { day: "Mon", completed: 42, pending: 8 },
  { day: "Tue", completed: 38, pending: 12 },
  { day: "Wed", completed: 51, pending: 5 },
  { day: "Thu", completed: 46, pending: 9 },
  { day: "Fri", completed: 58, pending: 3 },
  { day: "Sat", completed: 29, pending: 2 },
  { day: "Sun", completed: 22, pending: 1 },
]

const recentActions = [
  { id: 1, action: "Data synthesis report generated", status: "completed", time: "2m ago" },
  { id: 2, action: "Anomaly detection scan completed", status: "completed", time: "14m ago" },
  { id: 3, action: "Knowledge base optimization", status: "processing", time: "31m ago" },
  { id: 4, action: "Security audit initiated", status: "processing", time: "1h ago" },
  { id: 5, action: "Quarterly metrics compiled", status: "completed", time: "3h ago" },
  { id: 6, action: "Neural pathway recalibration", status: "completed", time: "5h ago" },
]

const chartConfig = {
  tasks: { label: "Tasks", color: "var(--chart-1)" },
  queries: { label: "Queries", color: "var(--chart-2)" },
  completed: { label: "Completed", color: "var(--chart-1)" },
  pending: { label: "Pending", color: "var(--chart-5)" },
  value: { label: "Score", color: "var(--chart-1)" },
} satisfies ChartConfig

const STAT_CARDS = [
  { label: "Total Tasks", value: "14,832", change: "+12%", trend: "up", icon: CheckCircle },
  { label: "Avg Response", value: "0.34s", change: "-8%", trend: "down", icon: Zap },
  { label: "Neural Load", value: "67%", change: "+3%", trend: "up", icon: Brain },
  { label: "Active Cores", value: "8/8", change: "100%", trend: "up", icon: Cpu },
]

export function AnalyticsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative z-10 flex flex-col h-svh">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-nexus uppercase">Analytics</h2>
        <div className="w-20" />
      </div>

      <ScrollArea className="flex-1 nexus-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_CARDS.map((stat, i) => (
              <HUDCard key={stat.label} delay={i * 0.1} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <stat.icon className="h-5 w-5 text-nexus/60" />
                  <span className={`text-xs font-mono ${stat.trend === "up" ? "text-emerald-400" : "text-amber-400"}`}>
                    {stat.trend === "up" ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                    {" "}{stat.change}
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
              </HUDCard>
            ))}
          </div>

          <HUDCard delay={0.4} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">24-Hour Activity</h3>
                <p className="text-xs text-muted-foreground">Tasks & queries</p>
              </div>
              <GlowBadge variant="processing">Live</GlowBadge>
            </div>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={activityData} accessibilityLayer margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-dim)" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} domain={[0, "auto"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="queries" type="monotone" stroke="var(--color-queries)" fill="var(--color-queries)" fillOpacity={0.15} strokeWidth={2} dot={false} />
                <Area dataKey="tasks" type="monotone" stroke="var(--color-tasks)" fill="var(--color-tasks)" fillOpacity={0.2} strokeWidth={2} dot={false} />
              </AreaChart>
            </ChartContainer>
          </HUDCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HUDCard delay={0.5} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Capability Matrix</h3>
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <RadarChart data={capabilityData} accessibilityLayer>
                  <PolarGrid stroke="var(--nexus-dim)" />
                  <PolarAngleAxis dataKey="capability" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--nexus-dim)" />
                  <Radar dataKey="value" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.25} strokeWidth={2} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ChartContainer>
            </HUDCard>

            <HUDCard delay={0.6} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Task Completion</h3>
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={taskData} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-dim)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </HUDCard>
          </div>

          <HUDCard delay={0.7} className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Nexus Actions</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-nexus/10 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActions.map((action) => (
                  <TableRow key={action.id} className="border-nexus/5 hover:bg-nexus/5">
                    <TableCell className="text-sm text-foreground font-mono">{action.action}</TableCell>
                    <TableCell>
                      <GlowBadge variant={action.status === "completed" ? "success" : "processing"}>{action.status}</GlowBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right font-mono">{action.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </HUDCard>
        </div>
      </ScrollArea>
    </div>
  )
}
