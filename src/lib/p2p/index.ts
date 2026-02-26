// p2p/index.ts — P2PManager singleton

import { getPeerId } from './identity'
import { PeerTracker } from './peers'
import { P2PMessaging } from './messaging'

let peerId: string | null = null
let peerTracker: PeerTracker | null = null
let messaging: P2PMessaging | null = null
let started = false

interface P2PStartResult {
  readonly peerId: string
  readonly peerTracker: PeerTracker
  readonly messaging: P2PMessaging
}

async function start(opts: { wsUrl?: string; displayName?: string } = {}): Promise<P2PStartResult> {
  if (started && peerId && peerTracker && messaging) {
    return { peerId, peerTracker, messaging }
  }

  try {
    peerId = await getPeerId()
  } catch (err) {
    throw new Error(`P2P identity failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const wsUrl = opts.wsUrl
  if (!wsUrl) throw new Error('P2P requires a relay WebSocket URL')

  peerTracker = new PeerTracker()

  try {
    messaging = new P2PMessaging({ peerId, wsUrl, peerTracker })
    messaging.setDisplayName(opts.displayName ?? '')
    await messaging.start()
  } catch (err) {
    throw new Error(`P2P messaging failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  started = true
  return { peerId, peerTracker, messaging }
}

async function stop(): Promise<void> {
  if (!started) return
  if (messaging) {
    await messaging.stop()
    messaging = null
  }
  if (peerTracker) {
    peerTracker.clear()
    peerTracker = null
  }
  peerId = null
  started = false
}

export const P2PManager = {
  start,
  stop,
  getPeerId: () => peerId,
  isStarted: () => started,
  getPeerTracker: () => peerTracker,
  getMessaging: () => messaging
}
