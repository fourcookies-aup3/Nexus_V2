import { useEffect, useRef, useState, useCallback } from "react"
import { supabase, nexusApi, type Message, type NexusCommand, type CommandStep } from "@/lib/supabase"
import { NexusOrb } from "@/components/nexus/orb"
import { Waveform, TypewriterText } from "@/components/nexus/effects"
import { HUDCard } from "@/components/nexus/hud-card"
import { GlowBadge } from "@/components/nexus/glow-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff, ArrowLeft, Send, Play, AlertTriangle, Loader2, FileCode, Terminal as TerminalIcon, Package, Rocket, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const STEP_ICONS: Record<string, any> = {
  create_workspace: FileCode,
  write_files: FileCode,
  install_dependencies: Package,
  run_tests: CheckCircle,
  launch_application: Rocket,
  search_web: TerminalIcon,
  compile_report: FileCode,
  send_message: Send,
  create_agent: TerminalIcon,
}

export function ChatView({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingCommand, setPendingCommand] = useState<{ command: NexusCommand; commandId: string } | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executionSteps, setExecutionSteps] = useState<CommandStep[]>([])
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    loadMessages()
    const channels = [
      supabase.channel("messages").on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      ).subscribe(),
      supabase.channel("command_steps").on("postgres_changes",
        { event: "INSERT", schema: "public", table: "command_steps" },
        (payload) => setExecutionSteps((prev) => [...prev, payload.new as CommandStep])
      ).subscribe(),
      supabase.channel("command_steps_update").on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "command_steps" },
        (payload) => setExecutionSteps((prev) => prev.map(s => s.id === (payload.new as CommandStep).id ? payload.new as CommandStep : s))
      ).subscribe(),
    ]
    return () => channels.forEach(ch => supabase.removeChannel(ch))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking, pendingCommand, executionSteps])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setVoiceSupported(!!SR)
  }, [])

  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(50)
    setMessages(data ?? [])
    setLoading(false)
    if (!data || data.length === 0) {
      const greeting: Message = {
        id: "welcome",
        role: "assistant",
        content: "Good day. I am Nexus, your autonomous AI employee. I can build applications, create agents, write code, research topics, and automate tasks. What would you like me to do?",
        created_at: new Date().toISOString(),
      }
      setMessages([greeting])
    }
  }

  const speakResponse = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 0.8
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes("Google") || v.name.includes("Daniel") || v.lang.startsWith("en"))
    if (preferred) utterance.voice = preferred
    window.speechSynthesis.speak(utterance)
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || thinking) return
    setInput("")
    setVoiceActive(false)
    if (recognitionRef.current) recognitionRef.current.stop()

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setThinking(true)
    setPendingCommand(null)
    setExecutionSteps([])

    try {
      const history = messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content }))
      const result = await nexusApi.sendMessage(text, history)

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.command.response,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setThinking(false)

      speakResponse(result.command.response)

      if (result.command.type !== "general_response" && result.command.actions?.length > 0) {
        setPendingCommand({ command: result.command, commandId: result.command_id })
      }
    } catch (err) {
      setThinking(false)
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I encountered an error processing your request: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    }
  }

  async function executeCommand() {
    if (!pendingCommand) return
    setExecuting(true)
    setExecutionSteps([])

    try {
      await nexusApi.executeCommand(pendingCommand.commandId, pendingCommand.command, true)
    } catch (err) {
      console.error("Execution error:", err)
    }

    setExecuting(false)
    setPendingCommand(null)
  }

  function toggleVoice() {
    if (!voiceSupported) return
    if (voiceActive) {
      recognitionRef.current?.stop()
      setVoiceActive(false)
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("")
      setInput(transcript)
      if (event.results[event.results.length - 1].isFinal) {
        setVoiceActive(false)
      }
    }

    recognition.onerror = () => setVoiceActive(false)
    recognition.onend = () => setVoiceActive(false)

    recognitionRef.current = recognition
    recognition.start()
    setVoiceActive(true)
  }

  return (
    <div className="relative z-10 flex flex-col h-svh">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexus/10">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-nexus">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Back</span>
        </Button>
        <div className="flex items-center gap-3">
          <NexusOrb size={36} />
          <div>
            <div className="text-sm font-semibold text-nexus nexus-text-glow">NEXUS</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-nexus-pulse" />
              {executing ? "Executing Task" : "Active & Listening"}
            </div>
          </div>
        </div>
        <div className="w-20" />
      </div>

      <ScrollArea className="flex-1 nexus-scrollbar">
        <div ref={scrollRef} className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <NexusOrb size={80} />
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} animate={msg.id !== "welcome" && i === messages.length - 1 && msg.role === "assistant"} />
          ))}

          {thinking && (
            <div className="flex items-start gap-3 animate-nexus-fade-up">
              <div className="shrink-0 mt-1"><NexusOrb size={32} /></div>
              <HUDCard className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Nexus processing
                  </span>
                  <Waveform bars={16} />
                </div>
              </HUDCard>
            </div>
          )}

          {pendingCommand && (
            <CommandPreview
              command={pendingCommand.command}
              executing={executing}
              onExecute={executeCommand}
            />
          )}

          {executionSteps.length > 0 && (
            <ExecutionTimeline steps={executionSteps} />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-nexus/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {voiceSupported && (
            <Button
              onClick={toggleVoice}
              size="icon"
              variant="outline"
              className={cn(
                "h-12 w-12 border-nexus/30 transition-all",
                voiceActive ? "bg-nexus/20 nexus-glow text-nexus" : "text-muted-foreground hover:text-nexus"
              )}
            >
              {voiceActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
          )}
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Tell Nexus what to build, research, or automate..."
              className="h-12 bg-card/50 border-nexus/20 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-nexus focus-visible:ring-nexus/30 font-mono text-sm"
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || thinking}
            size="icon"
            className="h-12 w-12 bg-nexus/10 border border-nexus/30 text-nexus hover:bg-nexus/20 hover:nexus-glow transition-all disabled:opacity-30"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, animate = false }: { message: Message; animate?: boolean }) {
  const isUser = message.role === "user"
  const [showFull, setShowFull] = useState(!animate)

  return (
    <div className={cn("flex items-start gap-3", isUser ? "flex-row-reverse animate-nexus-slide-in-right" : "animate-nexus-slide-in-left")}>
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground border border-nexus/10">YOU</div>
        ) : <NexusOrb size={32} />}
      </div>
      <div className={cn("max-w-[75%] px-5 py-3 nexus-clip-corner", isUser ? "bg-nexus/10 border border-nexus/25 text-foreground" : "bg-card/80 border border-nexus/15 text-foreground")}>
        {isUser || showFull ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <TypewriterText text={message.content} speed={20} className="text-sm leading-relaxed" onDone={() => setShowFull(true)} />
        )}
        <div className="mt-1 text-xs text-muted-foreground/40 font-mono">
          {new Date(message.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  )
}

function CommandPreview({ command, executing, onExecute }: { command: NexusCommand; executing: boolean; onExecute: () => void }) {
  return (
    <div className="animate-nexus-fade-up">
      <HUDCard glow className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-nexus" />
            <span className="text-xs font-mono uppercase tracking-wider text-nexus">Command Generated</span>
          </div>
          <GlowBadge variant={command.risk_level === "high" ? "error" : command.risk_level === "medium" ? "warning" : "success"}>
            {command.risk_level} risk
          </GlowBadge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">Type:</span> <span className="text-nexus">{command.type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Target:</span> <span className="text-foreground">{command.target}</span>
          </div>
          {command.parameters.language && (
            <div>
              <span className="text-muted-foreground">Language:</span> <span className="text-foreground">{command.parameters.language}</span>
            </div>
          )}
          {command.parameters.framework && (
            <div>
              <span className="text-muted-foreground">Framework:</span> <span className="text-foreground">{command.parameters.framework}</span>
            </div>
          )}
        </div>

        {command.actions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Execution Plan:</span>
            {command.actions.map((action, i) => {
              const Icon = STEP_ICONS[action] || TerminalIcon
              return (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-foreground/70">
                  <span className="text-nexus/50">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="h-3 w-3 text-nexus/60" />
                  <span>{action.replace(/_/g, " ")}</span>
                </div>
              )
            })}
          </div>
        )}

        {command.approval_required && (
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
            <AlertTriangle className="h-3 w-3" />
            <span>Approval required — this action is irreversible</span>
          </div>
        )}

        <Button
          onClick={onExecute}
          disabled={executing}
          className="w-full bg-nexus/10 border border-nexus/30 text-nexus hover:bg-nexus/20 hover:nexus-glow font-mono text-sm uppercase tracking-wider"
        >
          {executing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Executing...</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Execute Command</>
          )}
        </Button>
      </HUDCard>
    </div>
  )
}

function ExecutionTimeline({ steps }: { steps: CommandStep[] }) {
  return (
    <div className="animate-nexus-fade-up space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-nexus">Execution Timeline</span>
        <div className="flex-1 h-px bg-nexus/20" />
      </div>
      {steps.map((step) => {
        const Icon = STEP_ICONS[step.action] || TerminalIcon
        return (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 p-3 nexus-clip-corner border animate-nexus-fade-up",
              step.status === "completed" ? "border-nexus/20 bg-card/50" :
              step.status === "running" ? "border-nexus/40 bg-nexus/5 nexus-border-glow" :
              "border-muted-foreground/10 bg-card/30"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {step.status === "running" ? (
                <Loader2 className="h-4 w-4 text-nexus animate-spin" />
              ) : step.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <Icon className="h-4 w-4 text-nexus/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-foreground">{step.action.replace(/_/g, " ")}</span>
                <GlowBadge variant={step.status === "completed" ? "success" : "processing"}>
                  {step.status}
                </GlowBadge>
              </div>
              {step.output && (
                <pre className="mt-1.5 text-xs font-mono text-muted-foreground/70 whitespace-pre-wrap break-all max-h-32 overflow-y-auto nexus-scrollbar">
                  {step.output}
                </pre>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
