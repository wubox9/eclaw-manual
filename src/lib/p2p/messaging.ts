// p2p/messaging.ts — All P2P messages via WebSocket relay

import type {
  P2PMessage,
  RelayMessage,
  ChatAttachment,
  P2PMessagingEventMap,
  P2PMessagingEventName,
  EventUnsubscribe
} from '../types'
import type { PeerTracker } from './peers'

const PRESENCE_INTERVAL_MS = 15_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

type MessagingCallback<K extends P2PMessagingEventName> = (payload: P2PMessagingEventMap[K]) => void

export interface P2PMessagingOptions {
  readonly peerId: string
  readonly wsUrl: string
  readonly peerTracker: PeerTracker
}

export class P2PMessaging {
  private readonly _peerId: string
  private readonly _wsUrl: string
  private readonly _peerTracker: PeerTracker
  private readonly _listeners = new Map<string, Set<(payload: unknown) => void>>()
  private _displayName = ''
  private _presenceTimer: ReturnType<typeof setInterval> | null = null
  private _ws: WebSocket | null = null
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _reconnectDelay = RECONNECT_BASE_MS
  private _stopped = false

  constructor({ peerId, wsUrl, peerTracker }: P2PMessagingOptions) {
    this._peerId = peerId
    this._wsUrl = wsUrl
    this._peerTracker = peerTracker
  }

  on<K extends P2PMessagingEventName>(event: K, callback: MessagingCallback<K>): EventUnsubscribe {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    const cb = callback as (payload: unknown) => void
    this._listeners.get(event)!.add(cb)
    return () => { this._listeners.get(event)?.delete(cb) }
  }

  private _emit(event: string, payload: unknown): void {
    const cbs = this._listeners.get(event)
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(payload)
        } catch (err) {
          console.error(`P2PMessaging event error [${event}]:`, err)
        }
      }
    }
  }

  setDisplayName(name: string): void {
    this._displayName = name || ''
  }

  async start(): Promise<void> {
    this._stopped = false
    this._connect()
  }

  async stop(): Promise<void> {
    this._stopped = true
    if (this._presenceTimer) {
      clearInterval(this._presenceTimer)
      this._presenceTimer = null
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    if (this._ws) {
      this._ws.onclose = null
      this._ws.close()
      this._ws = null
    }
  }

  async sendBroadcast(text: string): Promise<P2PMessage> {
    const msg = this._createMessage('chat', text)
    const sent = this._send({
      type: 'chat',
      text: msg.text,
      sender: msg.sender,
      senderName: msg.senderName,
      timestamp: msg.timestamp,
      id: msg.id
    })
    if (!sent) throw new Error('Not connected to relay')
    this._emit('broadcast', msg)
    return msg
  }

  async sendDM(peerId: string, text: string, attachment?: ChatAttachment): Promise<P2PMessage> {
    const msg: P2PMessage = {
      ...this._createMessage('dm', text),
      recipient: peerId,
      attachment
    }
    const relay: RelayMessage = {
      type: 'dm',
      text: msg.text,
      sender: msg.sender,
      senderName: msg.senderName,
      timestamp: msg.timestamp,
      id: msg.id,
      recipient: peerId
    }
    if (attachment) relay.attachment = attachment
    const sent = this._send(relay)
    if (!sent) throw new Error('Not connected to relay')
    this._emit('dm:sent', msg)
    return msg
  }

  async announcePresence(): Promise<void> {
    if (!this._displayName) return
    this._send({
      type: 'presence',
      sender: this._peerId,
      senderName: this._displayName,
      timestamp: Date.now()
    })
  }

  private _connect(): void {
    if (this._stopped) return
    try {
      this._ws = new WebSocket(this._wsUrl)
    } catch (err) {
      console.error('WebSocket creation failed:', err)
      this._scheduleReconnect()
      return
    }

    this._ws.onopen = () => {
      this._reconnectDelay = RECONNECT_BASE_MS
      this._send({
        type: 'register',
        peerId: this._peerId,
        displayName: this._displayName
      })
      void this.announcePresence()
      if (this._presenceTimer) clearInterval(this._presenceTimer)
      this._presenceTimer = setInterval(() => {
        void this.announcePresence()
      }, PRESENCE_INTERVAL_MS)
    }

    this._ws.onmessage = (event) => {
      this._handleMessage(String(event.data))
    }

    this._ws.onclose = () => {
      if (this._presenceTimer) {
        clearInterval(this._presenceTimer)
        this._presenceTimer = null
      }
      this._ws = null
      this._scheduleReconnect()
    }

    this._ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }
  }

  private _scheduleReconnect(): void {
    if (this._stopped) return
    if (this._reconnectTimer) return
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this._connect()
    }, this._reconnectDelay)
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS)
  }

  private _send(msg: RelayMessage): boolean {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  private _createMessage(type: P2PMessage['type'], text: string): P2PMessage {
    return {
      type,
      text,
      sender: this._peerId,
      senderName: this._displayName || '',
      timestamp: Date.now(),
      id: crypto.randomUUID()
    }
  }

  private _handleMessage(data: string): void {
    let msg: RelayMessage
    try {
      msg = JSON.parse(data) as RelayMessage
    } catch {
      return
    }

    if (msg.type === 'peers' && msg.peers) {
      this._peerTracker.updateFromRelay(this._peerId, msg.peers)
      return
    }

    if (msg.sender) {
      this._peerTracker.markReachable(msg.sender)
      if (msg.senderName) {
        this._peerTracker.setDisplayName(msg.sender, msg.senderName)
      }
    }

    if (msg.type === 'presence') return

    if (msg.type === 'dm') {
      const p2pMsg: P2PMessage = {
        type: 'dm',
        text: msg.text || '',
        sender: msg.sender || '',
        senderName: msg.senderName || '',
        timestamp: msg.timestamp || Date.now(),
        id: msg.id || crypto.randomUUID(),
        recipient: msg.recipient,
        attachment: msg.attachment
      }
      this._emit('dm:received', p2pMsg)
      return
    }

    if (msg.type === 'chat') {
      const p2pMsg: P2PMessage = {
        type: 'chat',
        text: msg.text || '',
        sender: msg.sender || '',
        senderName: msg.senderName || '',
        timestamp: msg.timestamp || Date.now(),
        id: msg.id || crypto.randomUUID()
      }
      this._emit('broadcast', p2pMsg)
      return
    }
  }
}
