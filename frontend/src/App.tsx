import { useState, useRef, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import { ChatMode } from '@/types/chat'
import { ThemeProvider } from '@/context/ThemeContext'

function App() {
  const [selectedMode, setSelectedMode] = useState<ChatMode>('chat')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const chatInterfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatInterfaceRef.current) {
      chatInterfaceRef.current.scrollTop = chatInterfaceRef.current.scrollHeight
    }
  }, [])

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background overflow-hidden relative selection:bg-primary-500/20">
        {/* Simple, performant gradient background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] via-transparent to-secondary-500/[0.03] dark:from-primary-500/[0.06] dark:via-transparent dark:to-secondary-500/[0.04]" />
        </div>

        <Sidebar
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">
          <div className="flex-1 overflow-hidden h-full flex flex-col">
            <ChatInterface
              mode={selectedMode}
              ref={chatInterfaceRef}
            />
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App