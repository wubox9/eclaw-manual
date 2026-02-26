// voice.ts — Web Speech API wrapper for voice input + TTS output

import type {
  VoiceEventMap,
  VoiceEventName,
  VoiceAPI,
  SpeakerEventMap,
  SpeakerEventName,
  SpeakerAPI,
  EventUnsubscribe
} from './types'

// ===== Voice — Speech Recognition =====

const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition

let recognition: SpeechRecognition | null = null
let voiceIsListening = false
const voiceIsSupported = Boolean(SpeechRecognitionCtor)
let voiceLanguage = ''
let voiceListeners = new Map<string, Set<(payload: unknown) => void>>()

function voiceOn<K extends VoiceEventName>(event: K, callback: (payload: VoiceEventMap[K]) => void): EventUnsubscribe {
  if (!voiceListeners.has(event)) {
    voiceListeners.set(event, new Set())
  }
  const cb = callback as (payload: unknown) => void
  voiceListeners.get(event)!.add(cb)
  return () => { voiceListeners.get(event)?.delete(cb) }
}

function voiceEmit(event: string, payload: unknown): void {
  const cbs = voiceListeners.get(event)
  if (cbs) {
    for (const cb of cbs) {
      try {
        cb(payload)
      } catch (err) {
        console.error(`Voice event error [${event}]:`, err)
      }
    }
  }
}

function getErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    'not-allowed': 'Microphone access denied. Check permissions.',
    'no-speech': 'No speech detected.',
    'audio-capture': 'No microphone found.',
    'network': 'Network error during recognition.',
    'service-not-allowed': 'Speech service not available.'
  }
  return messages[error] ?? `Speech error: ${error}`
}

function createRecognition(): SpeechRecognition | null {
  if (!SpeechRecognitionCtor) return null

  const rec = new SpeechRecognitionCtor()
  rec.continuous = false
  rec.interimResults = true
  rec.lang = voiceLanguage || navigator.language || 'en-US'
  rec.maxAlternatives = 1

  rec.onstart = () => {
    voiceIsListening = true
    voiceEmit('start', {})
  }

  rec.onresult = (event: SpeechRecognitionEvent) => {
    let interim = ''
    let final = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        final += transcript
      } else {
        interim += transcript
      }
    }

    if (interim) {
      voiceEmit('interim', { text: interim })
    }
    if (final) {
      voiceEmit('final', { text: final.trim() })
    }
  }

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      voiceEmit('silence', {})
    } else {
      voiceEmit('error', { error: event.error, message: getErrorMessage(event.error) })
    }
  }

  rec.onend = () => {
    voiceIsListening = false
    voiceEmit('end', {})
  }

  return rec
}

function voiceStart(): boolean {
  if (!voiceIsSupported) {
    voiceEmit('error', { error: 'not-supported', message: 'Speech recognition not supported in this browser.' })
    return false
  }

  if (voiceIsListening) {
    voiceStop()
    return false
  }

  recognition = createRecognition()
  if (!recognition) return false

  try {
    recognition.start()
    return true
  } catch (err) {
    voiceEmit('error', { error: 'start-failed', message: err instanceof Error ? err.message : String(err) })
    return false
  }
}

function voiceStop(): void {
  if (recognition && voiceIsListening) {
    try {
      recognition.stop()
    } catch {
      // Already stopped
    }
  }
  voiceIsListening = false
}

function voiceAbort(): void {
  if (recognition) {
    try {
      recognition.abort()
    } catch {
      // Already aborted
    }
  }
  voiceIsListening = false
}

function voiceSetLanguage(lang: string): void {
  voiceLanguage = lang || ''
}

export const Voice: VoiceAPI = {
  on: voiceOn,
  start: voiceStart,
  stop: voiceStop,
  abort: voiceAbort,
  getIsListening: () => voiceIsListening,
  getIsSupported: () => voiceIsSupported,
  setLanguage: voiceSetLanguage
}

// ===== Speaker — Text-to-Speech via speechSynthesis =====

let speakerEnabled = false
let speakerSpeaking = false
let speakerLanguage = ''
let speakerListeners = new Map<string, Set<(payload: unknown) => void>>()

function speakerOn<K extends SpeakerEventName>(event: K, callback: (payload: SpeakerEventMap[K]) => void): EventUnsubscribe {
  if (!speakerListeners.has(event)) {
    speakerListeners.set(event, new Set())
  }
  const cb = callback as (payload: unknown) => void
  speakerListeners.get(event)!.add(cb)
  return () => { speakerListeners.get(event)?.delete(cb) }
}

function speakerEmit(event: string, payload: unknown): void {
  const cbs = speakerListeners.get(event)
  if (cbs) {
    for (const cb of cbs) {
      try {
        cb(payload)
      } catch (err) {
        console.error(`Speaker event error [${event}]:`, err)
      }
    }
  }
}

function speakerGetIsSupported(): boolean {
  return 'speechSynthesis' in window
}

function speakerSetEnabled(on: boolean, silent?: boolean): void {
  speakerEnabled = Boolean(on)
  if (!speakerEnabled) {
    speakerStopFn()
  }
  if (!silent) {
    speakerEmit('toggle', { enabled: speakerEnabled })
  }
}

function speakerToggle(): boolean {
  speakerSetEnabled(!speakerEnabled)
  return speakerEnabled
}

function speakerSetLanguage(lang: string): void {
  speakerLanguage = lang || ''
}

function stripMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/^[\s]*[-*+]\s/gm, '')
    .replace(/^[\s]*\d+\.\s/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

function speakerSpeak(text: string): boolean {
  if (!speakerGetIsSupported()) return false
  if (!text) return false

  window.speechSynthesis.cancel()

  const plain = stripMarkdown(text)
  if (!plain) return false

  const utterance = new SpeechSynthesisUtterance(plain)
  utterance.lang = speakerLanguage || navigator.language || 'en-US'
  utterance.rate = 1.0
  utterance.pitch = 1.0

  utterance.onstart = () => {
    speakerSpeaking = true
    speakerEmit('start', {})
  }

  utterance.onend = () => {
    speakerSpeaking = false
    speakerEmit('end', {})
  }

  utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
    speakerSpeaking = false
    if (event.error !== 'canceled') {
      speakerEmit('error', { error: event.error })
    }
    speakerEmit('end', {})
  }

  window.speechSynthesis.speak(utterance)
  return true
}

function speakerStopFn(): void {
  if (speakerGetIsSupported()) {
    window.speechSynthesis.cancel()
  }
  if (speakerSpeaking) {
    speakerSpeaking = false
    speakerEmit('end', {})
  }
}

export const Speaker: SpeakerAPI = {
  on: speakerOn,
  speak: speakerSpeak,
  stop: speakerStopFn,
  toggle: speakerToggle,
  setEnabled: speakerSetEnabled,
  getIsEnabled: () => speakerEnabled,
  getIsSpeaking: () => speakerSpeaking,
  getIsSupported: speakerGetIsSupported,
  setLanguage: speakerSetLanguage
}
