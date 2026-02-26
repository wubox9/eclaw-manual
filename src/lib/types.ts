// types.ts — Shared type definitions for eclaw-phone

// ===== Environment Config =====

export interface EnvConfig {
  readonly GATEWAY_TOKEN: string
  readonly GATEWAY_HOST: string
  readonly GATEWAY_PORT: number
  readonly GATEWAY_SECURE: boolean
  readonly SERVER_DEVICE_ID: string
  readonly SERVER_PUBLIC_KEY: string
  readonly SERVER_PRIVATE_KEY: string
  readonly RELAY_WS_URL: string
}

// ===== Device Identity =====

export interface DeviceKeyPair {
  readonly deviceId: string
  readonly publicKeyRaw: Uint8Array
  readonly privateKey: CryptoKey
  readonly publicKey: CryptoKey
}

export interface DeviceKeyMaterial {
  readonly publicJwk: JsonWebKey
  readonly privateJwk: JsonWebKey
}

export interface DeviceAuthParams {
  readonly clientId: string
  readonly clientMode: string
  readonly role: string
  readonly scopes: readonly string[]
  readonly token: string
  readonly nonce: string
}

export interface DeviceAuthResult {
  readonly id: string
  readonly publicKey: string
  readonly signature: string
  readonly signedAt: number
  readonly nonce: string
}

export interface DeviceIdentityAPI {
  getIdentity(): Promise<DeviceKeyPair>
  buildDeviceAuth(identity: DeviceKeyPair, params: DeviceAuthParams): Promise<DeviceAuthResult>
  getKeyMaterial(): Promise<DeviceKeyMaterial | null>
}

// ===== Gateway Client =====

export type ConnectionState = 'disconnected' | 'connecting' | 'challenging' | 'connected'

export interface GatewayConfig {
  host: string
  port: number
  token: string
  secure: boolean
}

export interface GatewayFrame {
  readonly type: 'req' | 'res' | 'event'
  readonly id?: string
  readonly method?: string
  readonly params?: Record<string, unknown>
  readonly ok?: boolean
  readonly payload?: unknown
  readonly error?: string
  readonly event?: string
}

export interface GatewayEventMap {
  '_connectionState': { state: ConnectionState }
  '_connected': unknown
  '_disconnected': { code: number; reason: string; wasConnected: boolean }
  '_reconnecting': { attempt: number; delay: number }
  '_error': { message: string }
  'chat': ChatEventPayload
  'agent': AgentEventPayload
  'connect.challenge': { nonce: string }
}

export type GatewayEventName = keyof GatewayEventMap | (string & {})

export type GatewayEventCallback<K extends GatewayEventName> =
  K extends keyof GatewayEventMap
    ? (payload: GatewayEventMap[K]) => void
    : (payload: unknown) => void

export interface ChatAttachment {
  readonly mimeType: string
  readonly fileName: string
  readonly content: string
  _previewUrl?: string
}

export interface GatewayClientAPI {
  connect(opts?: Partial<GatewayConfig>): void
  disconnect(): void
  configure(opts: Partial<GatewayConfig>): void
  getConfig(): GatewayConfig
  getState(): ConnectionState
  on<K extends GatewayEventName>(event: K, callback: GatewayEventCallback<K>): () => void
  request(method: string, params?: Record<string, unknown>): Promise<unknown>
  chatHistory(sessionKey?: string): Promise<ChatHistoryResult>
  chatSend(message: string, sessionKey?: string, attachments?: ChatAttachment[]): Promise<unknown>
  chatAbort(sessionKey?: string): Promise<unknown>
  chatInject(message: string, sessionKey?: string): Promise<unknown>
  readonly DEFAULT_PORT: number
}

// ===== Chat =====

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: number
  imageUrl?: string
  streaming?: boolean
}

export interface ChatEventPayload {
  readonly runId: string
  readonly state: 'delta' | 'final' | 'error'
  readonly message?: {
    readonly role?: string
    readonly content?: readonly MessageContent[]
    readonly timestamp?: number
  }
  readonly errorMessage?: string
}

export interface MessageContent {
  readonly type: 'text' | 'image'
  readonly text?: string
  readonly data?: string
  readonly mimeType?: string
}

export interface AgentEventPayload {
  readonly status: string
}

export interface ChatHistoryResult {
  readonly messages?: readonly RawGatewayMessage[]
}

export interface RawGatewayMessage {
  readonly id?: string
  readonly role?: string
  readonly text?: string
  readonly content?: readonly MessageContent[]
  readonly timestamp?: number
}

// ===== Voice =====

export interface VoiceEventMap {
  'start': Record<string, never>
  'interim': { text: string }
  'final': { text: string }
  'end': Record<string, never>
  'silence': Record<string, never>
  'error': { error: string; message: string }
}

export type VoiceEventName = keyof VoiceEventMap

export interface VoiceAPI {
  on<K extends VoiceEventName>(event: K, callback: (payload: VoiceEventMap[K]) => void): () => void
  start(): boolean
  stop(): void
  abort(): void
  getIsListening(): boolean
  getIsSupported(): boolean
  setLanguage(lang: string): void
}

// ===== Speaker =====

export interface SpeakerEventMap {
  'start': Record<string, never>
  'end': Record<string, never>
  'toggle': { enabled: boolean }
  'error': { error: string }
}

export type SpeakerEventName = keyof SpeakerEventMap

export interface SpeakerAPI {
  on<K extends SpeakerEventName>(event: K, callback: (payload: SpeakerEventMap[K]) => void): () => void
  speak(text: string): boolean
  stop(): void
  toggle(): boolean
  setEnabled(on: boolean, silent?: boolean): void
  getIsEnabled(): boolean
  getIsSpeaking(): boolean
  getIsSupported(): boolean
  setLanguage(lang: string): void
}

// ===== Location Tracking =====

export interface LocationRecord {
  readonly timestamp: string
  readonly lat: number
  readonly lng: number
  readonly accuracy: number
  readonly altitude: number | null
  readonly speed: number | null
}

export interface IntervalOption {
  readonly label: string
  readonly minutes: number
}

export interface LocationTrackerAPI {
  setEnabled(val: boolean): void
  setIntervalMinutes(minutes: number): void
  getIntervalMinutes(): number
  readonly intervalOptions: readonly IntervalOption[]
  recordNow(): void
  getRecords(): LocationRecord[]
  download(): void
}

// ===== App Settings =====

export interface AppSettings {
  host: string
  port: number
  token: string
  theme: 'dark' | 'amoled' | 'light'
  secure: boolean
  voiceLang: string
  speakerEnabled: boolean
  locationTracking: boolean
  locationInterval: number
  p2pEnabled: boolean
  p2pDisplayName: string
}

// ===== P2P =====

export interface PeerInfo {
  id: string
  connected: boolean
  discoveredAt: number
  connectedAt: number | null
  displayName: string | null
}

export interface P2PMessage {
  type: 'chat' | 'dm' | 'presence'
  text: string
  sender: string
  senderName: string
  timestamp: number
  id: string
  recipient?: string
  attachment?: ChatAttachment
}

export interface RelayMessage {
  type: 'register' | 'chat' | 'dm' | 'presence' | 'peers'
  peerId?: string
  displayName?: string
  text?: string
  sender?: string
  senderName?: string
  recipient?: string
  timestamp?: number
  id?: string
  peers?: ReadonlyArray<{ peerId: string; displayName: string }>
  attachment?: ChatAttachment
}

export interface PeerTrackerEventMap {
  'peer:connected': PeerInfo
  'peer:disconnected': PeerInfo
  'peers:changed': PeerInfo[]
}

export type PeerTrackerEventName = keyof PeerTrackerEventMap

export interface P2PMessagingEventMap {
  'broadcast': P2PMessage
  'dm:received': P2PMessage
  'dm:sent': P2PMessage
}

export type P2PMessagingEventName = keyof P2PMessagingEventMap

export type EventUnsubscribe = () => void
