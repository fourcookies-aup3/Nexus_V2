import { useEffect, useRef, useState } from "react"
import { supabase, type Message } from "@/lib/supabase"
import { NexusOrb } from "@/components/nexus/orb"
import { Waveform, TypewriterText } from "@/components/nexus/effects"
import { HUDCard } from "@/components/nexus/hud-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Send } from "lucide-react"
import { cn } from "@/lib/utils"

const NEXUS_REPLIES = [
  "I've analyzed the request. Based on current data streams, I recommend proceeding with the outlined strategy. Shall I prepare a detailed breakdown?",
  "Understood. I'm processing this through my cognitive matrices now. Initial assessment suggests three viable approaches — I can elaborate on any of them.",
  "I've cross-referenced this with our knowledge base. There are 14 relevant data points. Would you like me to synthesize a summary or provide the raw data?",
  "Affirmative. I've already begun preliminary work on this. My projections indicate a 94% success rate with the current parameters. Adjustments can be made.",
  "I've monitored the relevant systems since you last mentioned this. There have been two notable anomalies — both resolved autonomously. Full report available.",
  "Processing complete. I've identified an optimization that could improve efficiency by 23%. Would you like me to implement it or present the analysis first?",
  "I've been tracking this pattern across multiple data sources. The correlation coefficient is 0.87. This warrants attention — I've flagged it for priority review.",
  "Understood. I'll allocate additional processing resources to this task. Estimated completion: 3.2 seconds. I'll notify you the moment results are ready.",
]

export function ChatView({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50)
    setMessages(data ?? [])
    setLoading(false)
    if (!data || data.length === 0) {
      const greeting: Message = {
        id: "welcome",
        role: "assistant",
        content: "Good day. I am Nexus, your AI employee. How may I assist you today?",
        created_at: new Date().toISOString(),
      }
      setMessages([greeting])
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || thinking) return
    setInput("")

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const { error } = await supabase.from("messages").insert({
      role: "user",
      content: text,
    })
    if (error) console.error(error)

    setThinking(true)
    const delay = 1500 + Math.random() * 1500
    setTimeout(async () => {
      const reply = NEXUS_REPLIES[Math.floor(Math.random() * NEXUS_REPLIES.length)]
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setThinking(false)

      await supabase.from("messages").insert({
        role: "assistant",
        content: reply,
      })
      await supabase.from("nexus_logs").insert({
        level: "info",
        message: `User interaction processed: "${text.slice(0, 40)}${text.length > 40 ? "..." : ""}"`,
        source: "chat",
      })
    }, delay)
  }

  return (
    <div className="relative z-10 flex flex-col h-svh">
      {/* Header */}
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
              Active & Listening
            </div>
          </div>
        </div>
        <div className="w-20" />
      </div>

      {/* Messages */}
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
              <div className="shrink-0 mt-1">
                <NexusOrb size={32} />
              </div>
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
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-nexus/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Transmit message to Nexus..."
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
    <div
      className={cn(
        "flex items-start gap-3",
        isUser ? "flex-row-reverse animate-nexus-slide-in-right" : "animate-nexus-slide-in-left"
      )}
    >
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground border border-nexus/10">
            YOU
          </div>
        ) : (
          <NexusOrb size={32} />
        )}
      </div>
      <div
        className={cn(
          "max-w-[75%] px-5 py-3 nexus-clip-corner",
          isUser
            ? "bg-nexus/10 border border-nexus/25 text-foreground"
            : "bg-card/80 border border-nexus/15 text-foreground"
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : showFull ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <TypewriterText
            text={message.content}
            speed={20}
            className="text-sm leading-relaxed"
            onDone={() => setShowFull(true)}
          />
        )}
        <div className="mt-1 text-xs text-muted-foreground/40 font-mono">
          {new Date(message.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  )
}
