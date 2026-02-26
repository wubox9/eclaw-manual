import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type {
  AppSettings, ChatMessage, ChatEventPayload, AgentEventPayload,
  ConnectionState, MessageContent, PeerInfo, P2PMessage, ChatAttachment
} from '../lib/types'
import { ENV } from '../lib/env'
import { GatewayClient } from '../lib/gateway-client'
import { Voice, Speaker } from '../lib/voice'
import { LocationTracker, setToastFn } from '../lib/location'
import { P2PManager } from '../lib/p2p/index'
import type { PeerTracker } from '../lib/p2p/peers'
import type { P2PMessaging } from '../lib/p2p/messaging'

const STORAGE_KEY = 'eclaw-phone_settings'
const FIRST_RUN_KEY = 'eclaw_activated'
const MAX_MESSAGES = 1000

const DEFAULT_SETTINGS: AppSettings = {
  host: ENV.GATEWAY_HOST || 'localhost',
  port: ENV.GATEWAY_PORT || 18789,
  token: ENV.GATEWAY_TOKEN || '',
  theme: 'dark',
  secure: false,
  voiceLang: '',
  speakerEnabled: false,
  locationTracking: false,
  locationInterval: 60,
  p2pEnabled: false,
  p2pDisplayName: ''
}

function loadStoredSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>
      const settings = { ...DEFAULT_SETTINGS, ...parsed }
      if (ENV.GATEWAY_TOKEN) return { ...settings, token: ENV.GATEWAY_TOKEN }
      return settings
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

type ChatMode = 'gateway' | 'p2p-dm'

interface AppContextValue {
  // Settings
  settings: AppSettings
  settingsOpen: boolean
  toggleSettings: () => void
  saveSettings: (s: AppSettings) => void

  // Connection
  connectionState: ConnectionState

  // Agent
  agentStatus: string

  // Chat
  messages: ChatMessage[]
  streamingMessageId: string | null
  isAgentTyping: boolean
  sendMessage: (text: string, attachments?: ChatAttachment[]) => void
  handleAbort: () => void
  loadHistory: () => void

  // Voice
  isListening: boolean
  voiceStatus: string
  voiceStatusClass: string
  handleMicTap: () => void

  // Speaker
  speakerEnabled: boolean
  isSpeaking: boolean
  handleSpeakerToggle: () => void

  // Text input
  textInputVisible: boolean
  toggleTextInput: () => void

  // First run
  isFirstRun: boolean

  // Toast
  toastMessage: string
  toastVisible: boolean
  showToast: (msg: string) => void

  // Offline
  isOffline: boolean

  // P2P
  p2pEnabled: boolean
  p2pPeerId: string | null
  p2pDisplayName: string | null
  peers: PeerInfo[]
  chatMode: ChatMode
  switchChatMode: (mode: ChatMode) => void
  currentDMPeer: string | null
  dmMessages: Map<string, P2PMessage[]>
  peerPanelOpen: boolean
  togglePeerPanel: () => void
  startDMWith: (peerId: string) => void
  p2pPeerCount: number
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be within AppProvider')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  // ===== Settings =====
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ===== Connection =====
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // ===== Agent =====
  const [agentStatus, setAgentStatus] = useState('idle')

  // ===== Chat =====
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [isAgentTyping, setIsAgentTyping] = useState(false)
  const sessionKeyRef = useRef('main')
  const isLoadingHistoryRef = useRef(false)
  const userMsgCounterRef = useRef(0)

  // ===== Voice =====
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceStatusClass, setVoiceStatusClass] = useState('')

  // ===== Speaker =====
  const [speakerEnabled, setSpeakerEnabled] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // ===== Text input =====
  const [textInputVisible, setTextInputVisible] = useState(false)

  // ===== First run =====
  const [isFirstRun, setIsFirstRun] = useState(!localStorage.getItem(FIRST_RUN_KEY))

  // ===== Toast =====
  const [toastMessage, setToastMessage] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ===== Offline =====
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // ===== P2P =====
  const [p2pEnabled, setP2PEnabled] = useState(false)
  const [p2pPeerId, setP2PPeerId] = useState<string | null>(null)
  const [peers, setPeers] = useState<PeerInfo[]>([])
  const [chatMode, setChatMode] = useState<ChatMode>('gateway')
  const [currentDMPeer, setCurrentDMPeer] = useState<string | null>(null)
  const [dmMessages, setDmMessages] = useState<Map<string, P2PMessage[]>>(new Map())
  const [peerPanelOpen, setPeerPanelOpen] = useState(false)
  const peerTrackerRef = useRef<PeerTracker | null>(null)
  const messagingRef = useRef<P2PMessaging | null>(null)
  const chatModeRef = useRef<ChatMode>('gateway')
  const currentDMPeerRef = useRef<string | null>(null)

  // Keep refs in sync
  useEffect(() => { chatModeRef.current = chatMode }, [chatMode])
  useEffect(() => { currentDMPeerRef.current = currentDMPeer }, [currentDMPeer])

  // ===== Online/Offline listeners =====
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // ===== Toast =====
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    setToastVisible(true)
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false)
      setToastMessage('')
      toastTimerRef.current = null
    }, 2000)
  }, [])

  // Wire location tracker toast
  useEffect(() => {
    setToastFn(showToast)
  }, [showToast])

  // ===== Helpers =====
  const extractText = useCallback((msg: { content?: readonly MessageContent[] }): string => {
    if (!msg.content) return ''
    return msg.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')
  }, [])

  const extractImageUrl = useCallback((msg: { content?: readonly MessageContent[] }): string | undefined => {
    if (!msg.content) return undefined
    const img = msg.content.find(c => c.type === 'image')
    if (img?.data && img.mimeType) return `data:${img.mimeType};base64,${img.data}`
    return undefined
  }, [])

  // ===== Load history =====
  const loadHistory = useCallback(async () => {
    if (isLoadingHistoryRef.current) return
    isLoadingHistoryRef.current = true
    try {
      const result = await GatewayClient.chatHistory(sessionKeyRef.current)
      const raw = result?.messages ?? []
      const newMessages: ChatMessage[] = []
      for (const msg of raw) {
        if (!msg) continue
        const text = msg.text !== undefined ? msg.text : extractText(msg)
        const imageUrl = extractImageUrl(msg)
        if (!text && !imageUrl) continue
        const chatMsg: ChatMessage = {
          id: msg.id ?? crypto.randomUUID(),
          role: (msg.role ?? 'assistant') as ChatMessage['role'],
          text: text || '',
          timestamp: msg.timestamp ?? Date.now(),
        }
        if (imageUrl) chatMsg.imageUrl = imageUrl
        newMessages.push(chatMsg)
      }
      setMessages(newMessages)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      isLoadingHistoryRef.current = false
    }
  }, [extractText, extractImageUrl])

  // ===== Gateway events =====
  useEffect(() => {
    const unsubs: (() => void)[] = []

    unsubs.push(GatewayClient.on('_connectionState', ({ state }) => {
      setConnectionState(state)
    }))

    unsubs.push(GatewayClient.on('_connected', () => {
      if (chatModeRef.current === 'gateway') {
        void loadHistory()
      }
    }))

    unsubs.push(GatewayClient.on('_disconnected', () => {
      setStreamingMessageId(null)
      setIsAgentTyping(false)
    }))

    unsubs.push(GatewayClient.on('_error', ({ message }) => {
      console.error('Gateway error:', message)
    }))

    unsubs.push(GatewayClient.on('agent', (payload: AgentEventPayload) => {
      if (!payload) return
      const typing = payload.status === 'thinking' || payload.status === 'working' || payload.status === 'typing'
      setIsAgentTyping(typing)
      if (payload.status) setAgentStatus(payload.status)
    }))

    unsubs.push(GatewayClient.on('chat', (payload: ChatEventPayload) => {
      if (!payload) return
      const id = payload.runId

      if (payload.state === 'delta') {
        const text = extractText(payload.message ?? {})
        if (!text) return

        setStreamingMessageId(prev => {
          // If there is a different streaming message, finalize it first
          if (prev && prev !== id) {
            setMessages(msgs => msgs.map(m =>
              m.id === prev ? { ...m, streaming: false } : m
            ))
          }
          return id
        })

        setMessages(prev => {
          const existing = prev.find(m => m.id === id)
          if (existing) {
            return prev.map(m => m.id === id ? { ...m, text: m.text + text } : m)
          }
          return [...prev, {
            id,
            role: (payload.message?.role as ChatMessage['role']) ?? 'assistant',
            text,
            timestamp: payload.message?.timestamp ?? Date.now(),
            streaming: true
          }]
        })
        setIsAgentTyping(true)
        return
      }

      if (payload.state === 'final') {
        const text = extractText(payload.message ?? {})
        setMessages(prev => {
          const existing = prev.find(m => m.id === id)
          if (existing) {
            return prev.map(m => m.id === id ? { ...m, text: text || m.text, streaming: false } : m)
          }
          if (text) {
            return [...prev, {
              id,
              role: (payload.message?.role as ChatMessage['role']) ?? 'assistant',
              text,
              timestamp: payload.message?.timestamp ?? Date.now()
            }]
          }
          return prev
        })
        setStreamingMessageId(null)
        setIsAgentTyping(false)

        // Auto-speak finalized assistant message
        if (text && Speaker.getIsEnabled()) {
          Speaker.speak(text)
        }
        return
      }

      if (payload.state === 'error') {
        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, text: payload.errorMessage ?? 'Error', streaming: false } : m
        ))
        setStreamingMessageId(null)
        setIsAgentTyping(false)
      }
    }))

    return () => unsubs.forEach(fn => fn())
  }, [loadHistory, extractText])

  // ===== Apply theme =====
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // ===== Apply voice lang =====
  useEffect(() => {
    Voice.setLanguage(settings.voiceLang)
    Speaker.setLanguage(settings.voiceLang)
  }, [settings.voiceLang])

  // ===== Apply speaker =====
  useEffect(() => {
    Speaker.setEnabled(settings.speakerEnabled, true)
    setSpeakerEnabled(settings.speakerEnabled)
  }, [settings.speakerEnabled])

  // ===== Apply location tracking =====
  useEffect(() => {
    LocationTracker.setIntervalMinutes(settings.locationInterval || 60)
    LocationTracker.setEnabled(settings.locationTracking)
  }, [settings.locationTracking, settings.locationInterval])

  // ===== Initial gateway connect =====
  useEffect(() => {
    GatewayClient.connect({
      host: settings.host,
      port: settings.port,
      token: settings.token,
      secure: settings.secure
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== P2P start on mount if enabled =====
  useEffect(() => {
    if (settings.p2pEnabled) {
      void startP2P(settings.p2pDisplayName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== Voice events =====
  useEffect(() => {
    const unsubs: (() => void)[] = []

    unsubs.push(Voice.on('start', () => {
      setIsListening(true)
      setVoiceStatus('Listening...')
      setVoiceStatusClass('listening')
    }))

    unsubs.push(Voice.on('interim', ({ text }) => {
      setVoiceStatus(text)
    }))

    unsubs.push(Voice.on('final', ({ text }) => {
      setVoiceStatus('')
      setVoiceStatusClass('')
      if (text) sendMessage(text)
    }))

    unsubs.push(Voice.on('end', () => {
      setIsListening(false)
      setTimeout(() => {
        if (!Voice.getIsListening()) {
          setVoiceStatusClass('')
        }
      }, 300)
    }))

    unsubs.push(Voice.on('silence', () => {
      setVoiceStatus('')
      setVoiceStatusClass('')
    }))

    unsubs.push(Voice.on('error', ({ message }) => {
      setVoiceStatus(message)
      setVoiceStatusClass('error')
      setIsListening(false)
      setTimeout(() => {
        setVoiceStatus(prev => prev === message ? '' : prev)
        setVoiceStatusClass(prev => prev === 'error' ? '' : prev)
      }, 3000)
    }))

    return () => unsubs.forEach(fn => fn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== Speaker events =====
  useEffect(() => {
    const unsubs: (() => void)[] = []
    unsubs.push(Speaker.on('start', () => setIsSpeaking(true)))
    unsubs.push(Speaker.on('end', () => setIsSpeaking(false)))
    unsubs.push(Speaker.on('toggle', ({ enabled }) => {
      setSpeakerEnabled(enabled)
      setSettings(prev => {
        const next = { ...prev, speakerEnabled: enabled }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }))
    return () => unsubs.forEach(fn => fn())
  }, [])

  // ===== Service worker =====
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js?v=17', { scope: '/', updateViaCache: 'none' })
      .then(reg => {
        reg.update()
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                showToast('App updated — refreshing')
                setTimeout(() => location.reload(), 500)
              }
            })
          }
        })
      })
      .catch(err => console.error('SW registration failed:', err))
  }, [showToast])

  // ===== Send message =====
  const sendMessage = useCallback((text: string, attachments?: ChatAttachment[]) => {
    const trimmed = text.trim()
    if (!trimmed && (!attachments || attachments.length === 0)) return

    // P2P mode
    if (chatModeRef.current === 'p2p-dm' && messagingRef.current) {
      const peer = currentDMPeerRef.current
      if (!peer) {
        showToast('Select a peer to message first')
        return
      }
      const attachment = attachments?.[0]
      messagingRef.current.sendDM(peer, trimmed, attachment).catch(err => {
        console.error('P2P send error:', err)
        showToast('Failed to send P2P message')
      })
      return
    }

    // Gateway mode
    if (GatewayClient.getState() !== 'connected') {
      showToast('Not connected to gateway')
      return
    }

    userMsgCounterRef.current += 1
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${userMsgCounterRef.current}`,
      role: 'user',
      text: trimmed || '',
      timestamp: Date.now(),
      imageUrl: attachments?.[0]?._previewUrl
    }
    setMessages(prev => {
      const next = [...prev, userMsg]
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next
    })

    const gatewayAttachments = attachments
      ? attachments.map(({ mimeType, fileName, content }) => ({ mimeType, fileName, content }))
      : undefined

    GatewayClient.chatSend(trimmed || '', sessionKeyRef.current, gatewayAttachments).catch(err => {
      console.error('Failed to send:', err)
      showToast(`Failed to send: ${err instanceof Error ? err.message : String(err)}`)
    })
  }, [showToast])

  // ===== Abort =====
  const handleAbort = useCallback(() => {
    GatewayClient.chatAbort(sessionKeyRef.current).catch(err => {
      console.error('Failed to abort:', err)
    })
  }, [])

  // ===== Mic tap =====
  const handleMicTap = useCallback(() => {
    if (isFirstRun) {
      setIsFirstRun(false)
      localStorage.setItem(FIRST_RUN_KEY, '1')
    }
    if (!Voice.getIsSupported()) {
      showToast('Voice not supported in this browser')
      return
    }
    if (Voice.getIsListening()) {
      Voice.stop()
    } else {
      Speaker.stop()
      Voice.start()
    }
    if (navigator.vibrate) navigator.vibrate(30)
  }, [isFirstRun, showToast])

  // ===== Speaker toggle =====
  const handleSpeakerToggle = useCallback(() => {
    if (!Speaker.getIsSupported()) {
      showToast('Text-to-speech not supported')
      return
    }
    if (Speaker.getIsSpeaking()) {
      Speaker.stop()
      return
    }
    Speaker.toggle()
    if (navigator.vibrate) navigator.vibrate(20)
    showToast(Speaker.getIsEnabled() ? 'Speaker on' : 'Speaker off')
  }, [showToast])

  // ===== Text input toggle =====
  const toggleTextInput = useCallback(() => {
    if (isFirstRun) {
      setIsFirstRun(false)
      localStorage.setItem(FIRST_RUN_KEY, '1')
    }
    setTextInputVisible(prev => !prev)
  }, [isFirstRun])

  // ===== Settings toggle =====
  const toggleSettings = useCallback(() => {
    setSettingsOpen(prev => !prev)
  }, [])

  // ===== Save settings =====
  const saveSettings = useCallback((newSettings: AppSettings) => {
    const needsReconnect = newSettings.host !== settings.host || newSettings.port !== settings.port || newSettings.secure !== settings.secure
    const wasP2P = settings.p2pEnabled

    setSettings(newSettings)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)) } catch { /* ignore */ }
    setSettingsOpen(false)

    if (needsReconnect) {
      showToast('Reconnecting...')
      GatewayClient.connect({
        host: newSettings.host,
        port: newSettings.port,
        token: newSettings.token,
        secure: newSettings.secure
      })
    }

    if (newSettings.p2pEnabled && !wasP2P) {
      void startP2P(newSettings.p2pDisplayName)
    } else if (!newSettings.p2pEnabled && wasP2P) {
      void stopP2P()
    }
  }, [settings, showToast])

  // ===== P2P =====
  async function startP2P(displayName: string) {
    try {
      const wsUrl = ENV.RELAY_WS_URL
      showToast(wsUrl ? 'P2P: connecting to relay...' : 'P2P: no relay configured')
      const result = await P2PManager.start({ wsUrl, displayName })
      setP2PEnabled(true)
      setP2PPeerId(result.peerId)
      peerTrackerRef.current = result.peerTracker
      messagingRef.current = result.messaging

      // Wire peer events
      result.peerTracker.on('peers:changed', (allPeers) => {
        setPeers(allPeers.filter(p => p.id !== result.peerId))
      })

      // Wire messaging events
      result.messaging.on('dm:received', (msg) => {
        setDmMessages(prev => {
          const next = new Map(prev)
          const existing = next.get(msg.sender) ?? []
          next.set(msg.sender, [...existing, msg])
          return next
        })
      })

      result.messaging.on('dm:sent', (msg) => {
        if (!msg.recipient) return
        setDmMessages(prev => {
          const next = new Map(prev)
          const existing = next.get(msg.recipient!) ?? []
          next.set(msg.recipient!, [...existing, msg])
          return next
        })
      })

      result.messaging.on('broadcast', (msg) => {
        if (msg.sender === result.peerId) return
        setDmMessages(prev => {
          const next = new Map(prev)
          const existing = next.get(msg.sender) ?? []
          next.set(msg.sender, [...existing, msg])
          return next
        })
      })

      showToast(`P2P started (${result.peerId.slice(0, 8)}...)`)
    } catch (err) {
      console.error('Failed to start P2P:', err)
      showToast(`P2P: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function stopP2P() {
    try {
      await P2PManager.stop()
      setP2PEnabled(false)
      setP2PPeerId(null)
      setPeers([])
      setChatMode('gateway')
      setDmMessages(new Map())
      peerTrackerRef.current = null
      messagingRef.current = null
      showToast('P2P stopped')
    } catch (err) {
      console.error('Failed to stop P2P:', err)
    }
  }

  const togglePeerPanel = useCallback(() => setPeerPanelOpen(prev => !prev), [])

  const startDMWith = useCallback((peerId: string) => {
    setCurrentDMPeer(peerId)
    setChatMode('p2p-dm')
    setPeerPanelOpen(false)
  }, [])

  const switchChatMode = useCallback((mode: ChatMode) => {
    setChatMode(mode)
  }, [])

  // When switching to gateway mode, reload history
  useEffect(() => {
    if (chatMode === 'gateway' && GatewayClient.getState() === 'connected') {
      void loadHistory()
    }
  }, [chatMode, loadHistory])

  const p2pPeerCount = peers.filter(p => p.connected).length

  const value: AppContextValue = {
    settings,
    settingsOpen,
    toggleSettings,
    saveSettings,
    connectionState,
    agentStatus,
    messages,
    streamingMessageId,
    isAgentTyping,
    sendMessage,
    handleAbort,
    loadHistory,
    isListening,
    voiceStatus,
    voiceStatusClass,
    handleMicTap,
    speakerEnabled,
    isSpeaking,
    handleSpeakerToggle,
    textInputVisible,
    toggleTextInput,
    isFirstRun,
    toastMessage,
    toastVisible,
    showToast,
    isOffline,
    p2pEnabled,
    p2pPeerId,
    p2pDisplayName: settings.p2pDisplayName || null,
    peers,
    chatMode,
    switchChatMode,
    currentDMPeer,
    dmMessages,
    peerPanelOpen,
    togglePeerPanel,
    startDMWith,
    p2pPeerCount
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
