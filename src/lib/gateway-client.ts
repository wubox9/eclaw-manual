// gateway-client.ts — WebSocket client for eClaw Gateway protocol

import type {
  ConnectionState,
  GatewayConfig,
  GatewayFrame,
  GatewayEventName,
  GatewayEventCallback,
  GatewayClientAPI,
  ChatAttachment,
  ChatHistoryResult
} from './types'
import { DeviceIdentity } from './device'

interface PendingRequest {
  readonly resolve: (payload: unknown) => void
  readonly reject: (error: Error) => void
  readonly timeout: ReturnType<typeof setTimeout>
}

const PROTOCOL_VERSION = 3
const DEFAULT_PORT = 18789
const RECONNECT_DELAYS: readonly number[] = [1000, 2000, 4000, 8000, 15000, 30000]

let ws: WebSocket | null = null
let requestId = 0
let pendingRequests = new Map<string, PendingRequest>()
let eventListeners = new Map<string, Set<(payload: unknown) => void>>()
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false
let connectionState: ConnectionState = 'disconnected'
let challengeData: { nonce: string } | null = null
let config: GatewayConfig = {
  host: 'localhost',
  port: DEFAULT_PORT,
  token: '',
  secure: false
}

function getState(): ConnectionState {
  return connectionState
}

function setState(state: ConnectionState): void {
  connectionState = state
  emit('_connectionState', { state })
}

function on<K extends GatewayEventName>(event: K, callback: GatewayEventCallback<K>): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set())
  }
  const cb = callback as (payload: unknown) => void
  eventListeners.get(event)!.add(cb)
  return () => { eventListeners.get(event)?.delete(cb) }
}

function emit(event: string, payload: unknown): void {
  const listeners = eventListeners.get(event)
  if (listeners) {
    for (const cb of listeners) {
      try {
        cb(payload)
      } catch (err) {
        console.error(`Event listener error [${event}]:`, err)
      }
    }
  }
}

function configure(opts: Partial<GatewayConfig>): void {
  config = { ...config, ...opts }
}

function getConfig(): GatewayConfig {
  return { ...config }
}

function nextId(): string {
  requestId += 1
  return String(requestId)
}

function send(frame: Record<string, unknown>): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(frame))
    return true
  }
  return false
}

function request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextId()
    const frame = { type: 'req', id, method, params }

    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`Request timeout: ${method}`))
    }, 30000)

    pendingRequests.set(id, { resolve, reject, timeout })

    if (!send(frame)) {
      pendingRequests.delete(id)
      clearTimeout(timeout)
      reject(new Error('WebSocket not connected'))
    }
  })
}

function handleMessage(data: string): void {
  let frame: GatewayFrame
  try {
    frame = JSON.parse(data) as GatewayFrame
  } catch {
    console.error('Invalid JSON frame:', data)
    return
  }

  if (frame.type === 'res') {
    const pending = pendingRequests.get(frame.id ?? '')
    if (pending) {
      pendingRequests.delete(frame.id!)
      clearTimeout(pending.timeout)
      if (frame.ok) {
        pending.resolve(frame.payload)
      } else {
        const errMsg = typeof frame.error === 'string'
          ? frame.error
          : (frame.error ? JSON.stringify(frame.error) : 'Request failed')
        pending.reject(new Error(errMsg))
      }
    }
    return
  }

  if (frame.type === 'event') {
    if (frame.event === 'connect.challenge' && connectionState === 'connecting') {
      challengeData = frame.payload as { nonce: string }
      setState('challenging')
      void sendConnectHandshake()
      return
    }
    emit(frame.event ?? '', frame.payload)
    return
  }
}

async function sendConnectHandshake(): Promise<void> {
  const nonce = challengeData?.nonce ?? ''
  const clientId = 'openclaw-android'
  const clientMode = 'webchat'
  const role = 'operator'
  const scopes = ['operator.read', 'operator.write'] as const

  const connectParams: Record<string, unknown> = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: clientId,
      mode: clientMode,
      version: '1.0.0',
      platform: navigator.userAgent
    },
    role,
    scopes
  }

  if (config.token) {
    connectParams.auth = { token: config.token }
  }

  try {
    const identity = await DeviceIdentity.getIdentity()
    connectParams.device = await DeviceIdentity.buildDeviceAuth(identity, {
      clientId,
      clientMode,
      role,
      scopes,
      token: config.token || '',
      nonce
    })
  } catch (err) {
    console.warn('Device identity unavailable:', err)
  }

  const id = nextId()
  const frame = { type: 'req', id, method: 'connect', params: connectParams }

  const timeout = setTimeout(() => {
    pendingRequests.delete(id)
    console.error('Connect handshake timeout')
    disconnect()
  }, 10000)

  pendingRequests.set(id, {
    resolve: (payload: unknown) => {
      setState('connected')
      reconnectAttempt = 0
      emit('_connected', payload)
    },
    reject: (err: Error) => {
      console.error('Connect handshake failed:', err)
      setState('disconnected')
      emit('_error', { message: 'Handshake failed: ' + err.message })
    },
    timeout
  })

  send(frame)
}

function connect(opts?: Partial<GatewayConfig>): void {
  if (opts) {
    configure(opts)
  }

  if (ws) {
    const oldWs = ws
    oldWs.onopen = null
    oldWs.onmessage = null
    oldWs.onerror = null
    oldWs.onclose = null
    oldWs.close()
    ws = null
  }

  intentionalClose = false
  setState('connecting')
  clearPendingRequests()

  const protocol = config.secure ? 'wss' : 'ws'
  const url = `${protocol}://${config.host}:${config.port}`

  try {
    ws = new WebSocket(url)
  } catch (err) {
    setState('disconnected')
    emit('_error', { message: `Failed to create WebSocket: ${err instanceof Error ? err.message : String(err)}` })
    scheduleReconnect()
    return
  }

  const currentWs = ws

  ws.onopen = () => {
    // Wait for connect.challenge event from server
  }

  ws.onmessage = (event: MessageEvent) => {
    handleMessage(event.data as string)
  }

  ws.onerror = () => {
    emit('_error', { message: 'WebSocket error' })
  }

  ws.onclose = (event: CloseEvent) => {
    if (ws !== currentWs) return

    ws = null
    const wasConnected = connectionState === 'connected'
    setState('disconnected')
    clearPendingRequests()

    if (!intentionalClose) {
      emit('_disconnected', { code: event.code, reason: event.reason, wasConnected })
      scheduleReconnect()
    }
  }
}

function disconnect(): void {
  intentionalClose = true
  clearReconnectTimer()
  clearPendingRequests()
  setState('disconnected')
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }
}

function clearPendingRequests(): void {
  for (const { reject, timeout } of pendingRequests.values()) {
    clearTimeout(timeout)
    reject(new Error('Connection closed'))
  }
  pendingRequests = new Map()
}

function scheduleReconnect(): void {
  clearReconnectTimer()
  const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
  reconnectAttempt++
  emit('_reconnecting', { attempt: reconnectAttempt, delay })
  reconnectTimer = setTimeout(() => {
    if (connectionState === 'disconnected' && !intentionalClose) {
      connect()
    }
  }, delay)
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function chatHistory(sessionKey = 'main'): Promise<ChatHistoryResult> {
  return request('chat.history', { sessionKey }) as Promise<ChatHistoryResult>
}

function chatSend(message: string, sessionKey = 'main', attachments?: ChatAttachment[]): Promise<unknown> {
  const idempotencyKey = crypto.randomUUID()
  const params: Record<string, unknown> = { message, sessionKey, idempotencyKey }
  if (attachments && attachments.length > 0) {
    params.attachments = attachments
  }
  return request('chat.send', params)
}

function chatAbort(sessionKey = 'main'): Promise<unknown> {
  return request('chat.abort', { sessionKey })
}

function chatInject(message: string, sessionKey = 'main'): Promise<unknown> {
  return request('chat.inject', { message, sessionKey })
}

export const GatewayClient: GatewayClientAPI = {
  connect,
  disconnect,
  configure,
  getConfig,
  getState,
  on,
  request,
  chatHistory,
  chatSend,
  chatAbort,
  chatInject,
  DEFAULT_PORT
}
