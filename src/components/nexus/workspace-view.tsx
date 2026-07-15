import { useEffect, useState, useRef } from "react"
import { supabase, type FileChange, type Application, type CommandStep } from "@/lib/supabase"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, File, FilePlus, File as FileEdit, FileX, Terminal as TerminalIcon, AppWindow, Loader as Loader2, Folder } from "lucide-react"
import { cn } from "@/lib/utils"

const CHANGE_ICONS: Record<string, any> = {
  created: FilePlus,
  modified: FileEdit,
  deleted: FileX,
  renamed: File,
}

export function WorkspaceView({ onBack }: { onBack: () => void }) {
  const [fileChanges, setFileChanges] = useState<FileChange[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [steps, setSteps] = useState<CommandStep[]>([])
  const [loading, setLoading] = useState(true)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()
    const channel = supabase.channel("workspace_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "file_changes" },
        (payload) => setFileChanges(prev => [...prev, payload.new as FileChange]))
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" },
        () => loadApplications())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "command_steps" },
        (payload) => setSteps(prev => [...prev, payload.new as CommandStep]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "command_steps" },
        (payload) => setSteps(prev => prev.map(s => s.id === (payload.new as CommandStep).id ? payload.new as CommandStep : s)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" })
  }, [steps])

  async function loadAll() {
    await Promise.all([loadFileChanges(), loadApplications(), loadSteps()])
    setLoading(false)
  }

  async function loadFileChanges() {
    const { data } = await supabase.from("file_changes").select("*").order("created_at", { ascending: false }).limit(100)
    setFileChanges(data ?? [])
  }

  async function loadApplications() {
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false }).limit(20)
    setApplications(data ?? [])
  }

  async function loadSteps() {
    const { data } = await supabase.from("command_steps").select("*").order("created_at", { ascending: false }).limit(50)
    setSteps(data ? data.reverse() : [])
  }

  // Build file tree from file changes
  const fileTree = buildFileTree(fileChanges)

  return (
    <div className="relative z-10 flex flex-col h-svh">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-nexus uppercase">Workspace</h2>
        <div className="w-20" />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
        {/* File Tree */}
        <div className="border-r border-nexus/10 flex flex-col">
          <div className="px-5 py-3 border-b border-nexus/10 flex items-center gap-2">
            <Folder className="h-4 w-4 text-nexus/60" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">File Tree</span>
            <span className="ml-auto text-xs font-mono text-nexus/40">{fileChanges.length} changes</span>
          </div>
          <ScrollArea className="flex-1 nexus-scrollbar">
            <div className="p-4 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 text-nexus animate-spin" />
                </div>
              ) : fileTree.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/40 text-center py-10">
                  No files created yet.<br />Execute a command to see live file changes.
                </div>
              ) : (
                fileTree.map((node) => (
                  <FileTreeNode key={node.path} node={node} depth={0} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Terminal Stream */}
        <div className="border-r border-nexus/10 flex flex-col">
          <div className="px-5 py-3 border-b border-nexus/10 flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-nexus/60" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Terminal Stream</span>
            <div className="ml-auto flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500/40" />
              <div className="h-2 w-2 rounded-full bg-amber-500/40" />
              <div className="h-2 w-2 rounded-full bg-emerald-500/40" />
            </div>
          </div>
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto nexus-scrollbar bg-background/50 p-4 font-mono text-xs space-y-2"
          >
            {steps.length === 0 ? (
              <div className="text-muted-foreground/40 text-center py-10">
                No terminal output yet.<br />Execute a command to see live output.
              </div>
            ) : (
              steps.map((step) => (
                <div key={step.id} className="space-y-1 animate-nexus-fade-up">
                  <div className="flex items-center gap-2">
                    <span className="text-nexus/40">$</span>
                    <span className="text-nexus">{step.action.replace(/_/g, " ")}</span>
                    {step.status === "running" && <Loader2 className="h-3 w-3 text-nexus animate-spin" />}
                    {step.status === "completed" && <span className="text-emerald-400/60 text-xs">done</span>}
                  </div>
                  {step.output && (
                    <pre className="text-muted-foreground/70 whitespace-pre-wrap pl-4 border-l border-nexus/10">
                      {step.output}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Applications */}
        <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-nexus/10 flex items-center gap-2">
            <AppWindow className="h-4 w-4 text-nexus/60" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Applications</span>
            <span className="ml-auto text-xs font-mono text-nexus/40">{applications.length} apps</span>
          </div>
          <ScrollArea className="flex-1 nexus-scrollbar">
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 text-nexus animate-spin" />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/40 text-center py-10">
                  No applications built yet.<br />Build an app to see it here.
                </div>
              ) : (
                applications.map((app, i) => (
                  <HUDCard key={app.id} delay={i * 0.1} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{app.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {app.language} · {app.framework || app.app_type}
                        </div>
                      </div>
                      <GlowBadge variant={
                        app.status === "running" ? "success" :
                        app.status === "building" ? "processing" :
                        app.status === "error" ? "error" : "default"
                      }>
                        {app.status}
                      </GlowBadge>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground/60 space-y-0.5">
                      <div>Command: <span className="text-nexus/70">{app.start_command}</span></div>
                      {app.port && <div>Port: <span className="text-nexus/70">{app.port}</span></div>}
                      <div className="truncate">Path: {app.workspace_path}</div>
                    </div>
                    {app.status === "running" && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-nexus-pulse" />
                        <span className="text-xs font-mono text-emerald-400">Application is live</span>
                      </div>
                    )}
                  </HUDCard>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

type TreeNode = { path: string; name: string; isDir: boolean; children: TreeNode[]; change?: FileChange }

function buildFileTree(changes: FileChange[]): TreeNode[] {
  const root: TreeNode = { path: "", name: "", isDir: true, children: [] }
  const seen = new Set<string>()

  for (const change of changes) {
    if (seen.has(change.file_path)) continue
    seen.add(change.file_path)
    const parts = change.file_path.split("/")
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const path = parts.slice(0, i + 1).join("/")
      let child = current.children.find(c => c.name === part)
      if (!child) {
        child = { path, name: part, isDir: !isLast, children: [], change: isLast ? change : undefined }
        current.children.push(child)
      }
      if (isLast) {
        child.change = change
      }
      current = child
    }
  }

  return root.children
}

function FileTreeNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true)
  const Icon = node.change ? CHANGE_ICONS[node.change.change_type] || File : node.isDir ? Folder : File

  return (
    <div>
      <button
        onClick={() => node.isDir && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left py-1 px-2 hover:bg-nexus/5 rounded transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Icon className={cn(
          "h-3.5 w-3.5 shrink-0",
          node.change?.change_type === "created" ? "text-emerald-400" :
          node.change?.change_type === "modified" ? "text-amber-400" :
          node.change?.change_type === "deleted" ? "text-red-400" :
          "text-nexus/50"
        )} />
        <span className={cn("text-xs font-mono", node.isDir ? "text-foreground/80" : "text-foreground/60")}>
          {node.name}
        </span>
        {node.change && (
          <span className="ml-auto text-xs font-mono text-muted-foreground/30">
            {node.change.change_type}
          </span>
        )}
      </button>
      {node.isDir && expanded && node.children.map(child => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
