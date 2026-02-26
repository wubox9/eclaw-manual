import { useApp } from '../context/AppContext'

function truncatePeerId(id: string): string {
  if (!id) return 'Anonymous'
  if (id.length < 12) return id
  return id.slice(0, 6) + '...' + id.slice(-4)
}

export default function PeerPanel() {
  const { peerPanelOpen, togglePeerPanel, peers, p2pPeerId, p2pDisplayName, startDMWith } = useApp()

  const connectedCount = peers.filter(p => p.connected).length
  const selfLabel = p2pDisplayName ? `You: ${p2pDisplayName}` : (p2pPeerId ? `You: ${truncatePeerId(p2pPeerId)}` : '')

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) togglePeerPanel()
  }

  return (
    <div className={`peer-panel${peerPanelOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Peers" onClick={handleBackdropClick}>
      <div className="peer-sheet">
        <div className="peer-header">
          <div className="peer-header-info">
            <h2>Peers on Network</h2>
            <span className="peer-panel-self">{selfLabel}</span>
          </div>
          <span className="peer-panel-count">{connectedCount} connected</span>
          <button className="peer-close-btn" aria-label="Close" onClick={togglePeerPanel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="peer-list">
          {peers.length === 0 ? (
            <div className="peer-empty">No peers discovered yet</div>
          ) : (
            peers.map(peer => (
              <div key={peer.id} className="peer-item" onClick={() => startDMWith(peer.id)}>
                <div className={`peer-dot${peer.connected ? ' connected' : ''}`} />
                <div className="peer-info">
                  <div className="peer-name">{peer.displayName || truncatePeerId(peer.id)}</div>
                  {peer.displayName && <div className="peer-id">{truncatePeerId(peer.id)}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
