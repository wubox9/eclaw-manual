import { useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import MessageBubble from './MessageBubble'
import P2PMessageBubble from './P2PMessageBubble'

export default function ChatMessages() {
  const {
    messages, chatMode, currentDMPeer, dmMessages, p2pPeerId, peers,
    isFirstRun, loadHistory
  } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const pullStartRef = useRef(0)
  const isPullingRef = useRef(false)

  // Auto-scroll when messages change
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      requestAnimationFrame(() => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [messages, dmMessages, currentDMPeer, chatMode])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    autoScrollRef.current = (scrollHeight - scrollTop - clientHeight) < 100
  }, [])

  // Pull to refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      pullStartRef.current = e.touches[0].clientY
      isPullingRef.current = true
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current) return
    const dist = e.touches[0].clientY - pullStartRef.current
    if (dist > 80 && containerRef.current?.scrollTop === 0) {
      void loadHistory()
      isPullingRef.current = false
    }
  }, [loadHistory])

  const handleTouchEnd = useCallback(() => {
    isPullingRef.current = false
  }, [])

  // P2P DM mode
  if (chatMode === 'p2p-dm') {
    const msgs = currentDMPeer ? (dmMessages.get(currentDMPeer) ?? []) : []
    return (
      <main ref={containerRef} className="transcript-area" role="log" aria-label="Chat messages" aria-live="polite" onScroll={handleScroll}>
        {msgs.length === 0 ? (
          <div className="welcome-message"><p>No messages yet</p></div>
        ) : (
          msgs.map(msg => {
            const peer = peers.find(p => p.id === msg.sender)
            return <P2PMessageBubble key={msg.id} msg={msg} isSelf={msg.sender === p2pPeerId} peerDisplayName={peer?.displayName} />
          })
        )}
      </main>
    )
  }

  // Gateway mode
  // Show welcome when no messages and first-run has not yet been activated
  const showWelcome = messages.length === 0 && isFirstRun

  return (
    <main
      ref={containerRef}
      className="transcript-area"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showWelcome && (
        <div className="welcome-message">
          <div className="welcome-icon">
            <svg width="56" height="56" viewBox="0 0 120 120" fill="none">
              <defs>
                <linearGradient id="welcome-lobster" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff4d4d"/>
                  <stop offset="100%" stopColor="#991b1b"/>
                </linearGradient>
              </defs>
              <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#welcome-lobster)"/>
              <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#welcome-lobster)"/>
              <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#welcome-lobster)"/>
              <path d="M45 15 Q35 5 30 8" stroke="#ff4d4d" strokeWidth="3" strokeLinecap="round"/>
              <path d="M75 15 Q85 5 90 8" stroke="#ff4d4d" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="45" cy="35" r="6" fill="#050810"/>
              <circle cx="75" cy="35" r="6" fill="#050810"/>
              <circle cx="46" cy="34" r="2.5" fill="#00e5cc"/>
              <circle cx="76" cy="34" r="2.5" fill="#00e5cc"/>
            </svg>
          </div>
          <p>Tap the mic to start talking</p>
        </div>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
    </main>
  )
}
