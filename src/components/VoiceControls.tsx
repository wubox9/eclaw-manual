import { useRef, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

export default function VoiceControls() {
  const {
    voiceStatus, voiceStatusClass, isListening, isAgentTyping,
    handleMicTap, toggleTextInput, textInputVisible,
    handleAbort, isFirstRun
  } = useApp()

  const vcRef = useRef<HTMLDivElement>(null)
  const [animating, setAnimating] = useState(false)
  const prevFirstRunRef = useRef(isFirstRun)

  // Center the voice controls on screen during first-run
  useEffect(() => {
    if (!isFirstRun || !vcRef.current) return

    const vc = vcRef.current

    const recenter = () => {
      requestAnimationFrame(() => {
        const vcRect = vc.getBoundingClientRect()
        const vcCenter = vcRect.top + vcRect.height / 2
        const screenCenter = window.innerHeight / 2
        const offset = vcCenter - screenCenter
        vc.style.transform = `translateY(${-offset}px)`
      })
    }

    recenter()
    window.addEventListener('resize', recenter)

    return () => {
      window.removeEventListener('resize', recenter)
    }
  }, [isFirstRun])

  // Animate back to normal position when first-run is deactivated
  useEffect(() => {
    if (prevFirstRunRef.current && !isFirstRun && vcRef.current) {
      const vc = vcRef.current
      setAnimating(true)
      vc.style.transform = 'translateY(0)'

      let cleaned = false
      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        vc.removeEventListener('transitionend', onEnd)
        setAnimating(false)
        vc.style.transform = ''
      }

      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== 'transform') return
        cleanup()
      }
      vc.addEventListener('transitionend', onEnd)
      setTimeout(cleanup, 600)
    }
    prevFirstRunRef.current = isFirstRun
  }, [isFirstRun])

  return (
    <div
      ref={vcRef}
      className={`voice-controls${animating ? ' vc-animating' : ''}`}
    >
      <div className={`voice-status${voiceStatusClass ? ` ${voiceStatusClass}` : ''}`} role="status" aria-live="polite">
        {voiceStatus}
      </div>
      <div className="mic-row">
        <button
          className={`icon-btn small${textInputVisible ? ' active' : ''}`}
          aria-label="Toggle keyboard"
          onClick={toggleTextInput}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="14" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"/>
          </svg>
        </button>

        <button
          className={`mic-btn${isListening ? ' listening' : ''}`}
          aria-label="Voice input"
          onClick={handleMicTap}
        >
          <svg className={`mic-icon${isListening ? ' hidden' : ''}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <svg className={`stop-icon${!isListening ? ' hidden' : ''}`} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
          <div className="mic-pulse" />
        </button>

        {isAgentTyping ? (
          <button className="icon-btn small" aria-label="Stop response" onClick={handleAbort}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        ) : (
          <div className="icon-btn small invisible" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
