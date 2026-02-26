import { useState, useRef, useCallback } from 'react'
import type { ChatMessage } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { useApp } from '../context/AppContext'

interface Props {
  msg: ChatMessage
}

export default function MessageBubble({ msg }: Props) {
  const { showToast } = useApp()
  const [showTime, setShowTime] = useState(false)
  const [copied, setCopied] = useState(false)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatTime = (ts: number) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const startPress = useCallback(() => {
    pressTimerRef.current = setTimeout(() => {
      if (navigator.clipboard && msg.text) {
        navigator.clipboard.writeText(msg.text).then(() => showToast('Copied to clipboard')).catch(() => showToast('Copy failed'))
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      if (navigator.vibrate) navigator.vibrate(50)
    }, 500)
  }, [msg.text, showToast])

  const cancelPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }, [])

  const contentHtml = msg.role === 'user'
    ? Markdown.escapeHtml(msg.text || '')
    : Markdown.render(msg.text || '')

  return (
    <div
      className={`message msg-${msg.role}${msg.streaming ? ' streaming' : ''}${copied ? ' copied' : ''}`}
      data-msg-id={msg.id}
      onClick={() => setShowTime(prev => !prev)}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
    >
      {msg.imageUrl && (
        <img className="msg-image" src={msg.imageUrl} alt="Photo" />
      )}
      {msg.text && (
        <div className="msg-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      )}
      <div className={`msg-time${showTime ? ' visible' : ''}`}>
        {formatTime(msg.timestamp)}
      </div>
    </div>
  )
}
