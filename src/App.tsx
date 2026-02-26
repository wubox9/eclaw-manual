import { useEffect, useRef } from 'react'
import { useApp } from './context/AppContext'
import TopBar from './components/TopBar'
import ChatTabs from './components/ChatTabs'
import ChatMessages from './components/ChatMessages'
import VoiceControls from './components/VoiceControls'
import TextBar from './components/TextBar'
import SettingsPanel from './components/SettingsPanel'
import PeerPanel from './components/PeerPanel'
import Toast from './components/Toast'
import OfflineBanner from './components/OfflineBanner'

export default function App() {
  const { isFirstRun, textInputVisible } = useApp()
  const textBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => {
      if (!textBarRef.current) return
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      textBarRef.current.style.transform = offset > 0 ? `translateY(-${offset}px)` : ''
    }
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [])

  return (
    <div className={`app${isFirstRun ? ' first-run' : ''}`}>
      <OfflineBanner />
      <TopBar />
      <ChatTabs />
      <ChatMessages />
      <VoiceControls />
      <TextBar ref={textBarRef} />
      <SettingsPanel />
      <PeerPanel />
      <Toast />
    </div>
  )
}
