// p2p/peers.ts — Peer state tracking with typed event emitter

import type {
  PeerInfo,
  PeerTrackerEventMap,
  PeerTrackerEventName,
  EventUnsubscribe
} from '../types'

type PeerTrackerCallback<K extends PeerTrackerEventName> = (payload: PeerTrackerEventMap[K]) => void

const STALE_PEER_TTL_MS = 5 * 60 * 1000

export class PeerTracker {
  private readonly _peers = new Map<string, PeerInfo>()
  private readonly _listeners = new Map<string, Set<(payload: unknown) => void>>()
  private _pruneTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this._pruneTimer = setInterval(() => this._pruneStalePeers(), STALE_PEER_TTL_MS)
  }

  on<K extends PeerTrackerEventName>(event: K, callback: PeerTrackerCallback<K>): EventUnsubscribe {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    const cb = callback as (payload: unknown) => void
    this._listeners.get(event)!.add(cb)
    return () => { this._listeners.get(event)?.delete(cb) }
  }

  private _emit<K extends PeerTrackerEventName>(event: K, payload: PeerTrackerEventMap[K]): void {
    const cbs = this._listeners.get(event)
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(payload)
        } catch (err) {
          console.error(`PeerTracker event error [${event}]:`, err)
        }
      }
    }
  }

  updateFromRelay(localPeerId: string, relayPeers: ReadonlyArray<{ peerId: string; displayName: string }>): void {
    const now = Date.now()
    const incomingIds = new Set<string>()

    for (const rp of relayPeers) {
      if (rp.peerId === localPeerId) continue
      incomingIds.add(rp.peerId)

      const existing = this._peers.get(rp.peerId)
      if (existing) {
        if (rp.displayName && rp.displayName !== existing.displayName) {
          this._peers.set(rp.peerId, { ...existing, displayName: rp.displayName })
        }
        if (!existing.connected) {
          const updated: PeerInfo = {
            ...existing,
            connected: true,
            connectedAt: now,
            displayName: rp.displayName || existing.displayName
          }
          this._peers.set(rp.peerId, updated)
          this._emit('peer:connected', { ...updated })
        }
      } else {
        const peer: PeerInfo = {
          id: rp.peerId,
          connected: true,
          discoveredAt: now,
          connectedAt: now,
          displayName: rp.displayName || null
        }
        this._peers.set(rp.peerId, peer)
        this._emit('peer:connected', { ...peer })
      }
    }

    for (const [id, peer] of this._peers) {
      if (!incomingIds.has(id) && peer.connected) {
        const updated: PeerInfo = { ...peer, connected: false }
        this._peers.set(id, updated)
        this._emit('peer:disconnected', { ...updated })
      }
    }

    this._emit('peers:changed', this.getPeers())
  }

  markReachable(peerIdStr: string): void {
    const existing = this._peers.get(peerIdStr)
    if (!existing) {
      const peer: PeerInfo = {
        id: peerIdStr,
        connected: true,
        discoveredAt: Date.now(),
        connectedAt: Date.now(),
        displayName: null
      }
      this._peers.set(peerIdStr, peer)
      this._emit('peer:connected', { ...peer })
      this._emit('peers:changed', this.getPeers())
      return
    }
    if (existing.connected) return
    const updated: PeerInfo = {
      ...existing,
      connected: true,
      connectedAt: Date.now()
    }
    this._peers.set(peerIdStr, updated)
    this._emit('peer:connected', { ...updated })
    this._emit('peers:changed', this.getPeers())
  }

  setDisplayName(peerIdStr: string, name: string): void {
    const existing = this._peers.get(peerIdStr)
    if (!existing) return
    const updated: PeerInfo = { ...existing, displayName: name }
    this._peers.set(peerIdStr, updated)
    this._emit('peers:changed', this.getPeers())
  }

  getDisplayName(peerIdStr: string): string | null {
    return this._peers.get(peerIdStr)?.displayName ?? null
  }

  getPeers(): PeerInfo[] {
    return Array.from(this._peers.values())
      .sort((a, b) => {
        if (a.connected && !b.connected) return -1
        if (!a.connected && b.connected) return 1
        return (b.discoveredAt || 0) - (a.discoveredAt || 0)
      })
  }

  getConnectedCount(): number {
    let count = 0
    for (const peer of this._peers.values()) {
      if (peer.connected) count++
    }
    return count
  }

  clear(): void {
    this._peers.clear()
    if (this._pruneTimer) {
      clearInterval(this._pruneTimer)
      this._pruneTimer = null
    }
    this._emit('peers:changed', [])
  }

  private _pruneStalePeers(): void {
    const now = Date.now()
    let pruned = false
    for (const [id, peer] of this._peers) {
      if (!peer.connected && peer.connectedAt && (now - peer.connectedAt) > STALE_PEER_TTL_MS) {
        this._peers.delete(id)
        pruned = true
      }
    }
    if (pruned) {
      this._emit('peers:changed', this.getPeers())
    }
  }
}
