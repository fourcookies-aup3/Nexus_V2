import { useEffect, useState } from "react"
import { BootScreen } from "@/components/nexus/boot-screen"
import { Dashboard, type NexusView } from "@/components/nexus/dashboard"
import { ChatView } from "@/components/nexus/chat-view"
import { AnalyticsView } from "@/components/nexus/analytics-view"
import { SystemView } from "@/components/nexus/system-view"
import { DataStream, GridBackground, RadialGlow, ScanLine } from "@/components/nexus/effects"
import { supabase } from "@/lib/supabase"

const BOOT_KEY = "nexus_boot_seen"

export function App() {
  const [booted, setBooted] = useState(false)
  const [view, setView] = useState<NexusView>("dashboard")
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    const seen = sessionStorage.getItem(BOOT_KEY)
    if (seen) setBooted(true)
  }, [])

  async function handleBootComplete() {
    sessionStorage.setItem(BOOT_KEY, "1")
    setBooted(true)
    await supabase.from("nexus_logs").insert({
      level: "success",
      message: "User session established — Nexus interface active",
      source: "interface",
    })
  }

  function handleNavigate(target: NexusView) {
    if (target === view) return
    setTransitioning(true)
    setTimeout(() => {
      setView(target)
      setTransitioning(false)
    }, 300)
  }

  if (!booted) {
    return <BootScreen onComplete={handleBootComplete} />
  }

  return (
    <div className="relative min-h-svh bg-background overflow-hidden">
      {/* Background layers */}
      <GridBackground />
      <RadialGlow />
      <DataStream count={8} />
      <ScanLine />

      {/* Page content with transition */}
      <div
        key={view}
        className={transitioning ? "animate-nexus-page-exit" : "animate-nexus-page-enter"}
      >
        {view === "dashboard" && <Dashboard onNavigate={handleNavigate} />}
        {view === "chat" && <ChatView onBack={() => handleNavigate("dashboard")} />}
        {view === "analytics" && <AnalyticsView onBack={() => handleNavigate("dashboard")} />}
        {view === "system" && <SystemView onBack={() => handleNavigate("dashboard")} />}
      </div>
    </div>
  )
}

export default App
