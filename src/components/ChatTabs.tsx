import { useApp } from '../context/AppContext'

export default function ChatTabs() {
  const { p2pEnabled, chatMode, switchChatMode, currentDMPeer, peers } = useApp()

  if (!p2pEnabled) return null

  const peerName = currentDMPeer
    ? (peers.find(p => p.id === currentDMPeer)?.displayName ?? null)
    : null

  return (
    <nav className="chat-tabs" role="tablist" aria-label="Chat mode">
      <button
        className={`chat-tab${chatMode === 'gateway' ? ' active' : ''}`}
        data-mode="gateway"
        role="tab"
        aria-selected={chatMode === 'gateway'}
        onClick={() => switchChatMode('gateway')}
      >
        Gateway
      </button>
      <button
        className={`chat-tab${chatMode === 'p2p-dm' ? ' active' : ''}`}
        data-mode="p2p-dm"
        role="tab"
        aria-selected={chatMode === 'p2p-dm'}
        onClick={() => switchChatMode('p2p-dm')}
      >
        {peerName ? `Message: ${peerName}` : 'Message'}
      </button>
    </nav>
  )
}
