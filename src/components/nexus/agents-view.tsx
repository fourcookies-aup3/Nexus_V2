import { useEffect, useState } from "react"
import { supabase, nexusApi, type Agent, type AgentTask } from "@/lib/supabase"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { ArrowLeft, Plus, Loader2, Brain, Code, Search, Mail, Zap, Database, Globe, Gamepad2, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

const AGENT_TYPE_ICONS: Record<string, any> = {
  coding: Code,
  research: Search,
  email: Mail,
  automation: Zap,
  data: Database,
  web: Globe,
  game: Gamepad2,
  custom: Brain,
}

const AGENT_TYPES = [
  { type: "coding", label: "Coding Agent", icon: Code, desc: "Writes code, creates projects, runs tests" },
  { type: "game", label: "Game Developer", icon: Gamepad2, desc: "Builds 2D/3D games with Pygame, Unity" },
  { type: "research", label: "Research Agent", icon: Search, desc: "Searches web, compiles reports" },
  { type: "email", label: "Email Agent", icon: Mail, desc: "Reads, composes, sends emails" },
  { type: "automation", label: "Automation Agent", icon: Zap, desc: "Creates workflows, triggers n8n" },
  { type: "data", label: "Data Agent", icon: Database, desc: "Analyzes data, creates visualizations" },
  { type: "web", label: "Web Agent", icon: Globe, desc: "Navigates websites, scrapes data" },
  { type: "custom", label: "Custom Agent", icon: Brain, desc: "AI-generated custom agent" },
]

export function AgentsView({ onBack }: { onBack: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [customDesc, setCustomDesc] = useState("")
  const [selectedType, setSelectedType] = useState<string>("coding")
  const [tasksByAgent, setTasksByAgent] = useState<Record<string, AgentTask[]>>({})

  useEffect(() => {
    loadAgents()
    const channel = supabase.channel("agents_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" },
        () => loadAgents())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_tasks" },
        () => loadAgents())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadAgents() {
    try {
      const result = await nexusApi.getAgents()
      setAgents(result.agents || [])
      setLoading(false)
      // Load tasks for each agent
      for (const agent of result.agents || []) {
        if (agent.status === "active" || agent.status === "processing") {
          const tasksResult = await nexusApi.getAgentTasks(agent.id)
          setTasksByAgent(prev => ({ ...prev, [agent.id]: tasksResult.tasks || [] }))
        }
      }
    } catch {
      setLoading(false)
    }
  }

  async function createAgent() {
    setCreating(true)
    try {
      const desc = selectedType === "custom" ? customDesc : undefined
      await nexusApi.createAgent(selectedType, desc)
      setShowCreate(false)
      setCustomDesc("")
      await loadAgents()
    } catch (err) {
      console.error("Create agent error:", err)
    }
    setCreating(false)
  }

  const activeCount = agents.filter(a => a.status === "active" || a.status === "processing").length
  const idleCount = agents.filter(a => a.status === "idle").length

  return (
    <div className="relative z-10 flex flex-col h-svh">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-nexus uppercase">Agent Registry</h2>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="gap-2 bg-nexus/10 border border-nexus/30 text-nexus hover:bg-nexus/20 font-mono text-xs uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Create Agent
        </Button>
      </div>

      <ScrollArea className="flex-1 nexus-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <HUDCard className="px-5 py-4">
              <div className="text-2xl font-bold text-foreground">{agents.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Agents</div>
            </HUDCard>
            <HUDCard className="px-5 py-4">
              <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Active</div>
            </HUDCard>
            <HUDCard className="px-5 py-4">
              <div className="text-2xl font-bold text-muted-foreground">{idleCount}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Idle</div>
            </HUDCard>
          </div>

          {/* Agent Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-nexus animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent, i) => {
                const Icon = AGENT_TYPE_ICONS[agent.type] || Brain
                const tasks = tasksByAgent[agent.id] || []
                return (
                  <HUDCard key={agent.id} delay={i * 0.1} className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center border",
                          agent.status === "processing" ? "border-nexus/40 bg-nexus/10 nexus-glow" :
                          agent.status === "active" ? "border-emerald-500/40 bg-emerald-500/10" :
                          agent.status === "error" ? "border-red-500/40 bg-red-500/10" :
                          "border-nexus/15 bg-card/50"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            agent.status === "processing" ? "text-nexus animate-nexus-pulse" :
                            agent.status === "active" ? "text-emerald-400" :
                            "text-nexus/60"
                          )} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{agent.name}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">{agent.type}</div>
                        </div>
                      </div>
                      <GlowBadge variant={
                        agent.status === "active" || agent.status === "processing" ? "processing" :
                        agent.status === "error" ? "error" : "default"
                      }>
                        {agent.status}
                      </GlowBadge>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {agent.skills?.slice(0, 4).map((skill: string) => (
                        <span key={skill} className="text-xs font-mono text-nexus/60 bg-nexus/5 px-2 py-0.5 rounded border border-nexus/10">
                          {skill}
                        </span>
                      ))}
                      {agent.skills?.length > 4 && (
                        <span className="text-xs font-mono text-muted-foreground">
                          +{agent.skills.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Tools */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Cpu className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {agent.tools?.length || 0} tools · {agent.permissions?.length || 0} permissions
                      </span>
                    </div>

                    {/* Active Task */}
                    {tasks.length > 0 && tasks[0].status === "running" && (
                      <div className="mt-3 p-3 bg-nexus/5 border border-nexus/15 rounded nexus-clip-corner">
                        <div className="flex items-center gap-2 mb-1">
                          <Loader2 className="h-3 w-3 text-nexus animate-spin" />
                          <span className="text-xs font-mono text-nexus">Running: {tasks[0].title}</span>
                        </div>
                      </div>
                    )}

                    {/* Workspace */}
                    <div className="mt-3 text-xs font-mono text-muted-foreground/40 truncate">
                      {agent.workspace_path || "no workspace"}
                    </div>
                  </HUDCard>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Agent Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-nexus/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-nexus font-mono uppercase tracking-wider">Create New Agent</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select an agent type or describe a custom agent for NEXUS to generate.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AGENT_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                className={cn(
                  "p-4 nexus-clip-corner border text-left transition-all",
                  selectedType === t.type
                    ? "border-nexus/40 bg-nexus/10 nexus-border-glow"
                    : "border-nexus/10 bg-card/50 hover:border-nexus/20"
                )}
              >
                <t.icon className={cn("h-6 w-6 mb-2", selectedType === t.type ? "text-nexus" : "text-nexus/50")} />
                <div className="text-xs font-semibold text-foreground">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>

          {selectedType === "custom" && (
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Describe the agent you want:
              </label>
              <Input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="e.g., A social media manager agent that posts content and tracks engagement..."
                className="bg-background border-nexus/20 font-mono text-sm"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={createAgent}
              disabled={creating || (selectedType === "custom" && !customDesc.trim())}
              className="bg-nexus/10 border border-nexus/30 text-nexus hover:bg-nexus/20"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
