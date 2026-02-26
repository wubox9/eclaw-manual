import { useState } from 'react'
import type { P2PMessage, ChatAttachment } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { useApp } from '../context/AppContext'

function truncatePeerId(id: string): string {
  if (!id) return 'Anonymous'
  if (id.length < 12) return id
  return id.slice(0, 6) + '...' + id.slice(-4)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function AttachmentView({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.mimeType.startsWith('image/')) {
    return (
      <div className="msg-file-attachment">
        <img className="msg-image" alt={attachment.fileName || 'Image'} src={`data:${attachment.mimeType};base64,${attachment.content}`} />
      </div>
    )
  }
  return (
    <div className="msg-file-attachment">
      <a className="msg-file-link" download={attachment.fileName || 'file'} href={`data:${attachment.mimeType};base64,${attachment.content}`}>
        {attachment.fileName || 'Download file'}
      </a>
      <span className="msg-file-size">{formatFileSize(attachment.content.length * 0.75)}</span>
    </div>
  )
}

interface Props {
  msg: P2PMessage
  isSelf: boolean
  peerDisplayName?: string | null
}

export default function P2PMessageBubble({ msg, isSelf, peerDisplayName }: Props) {
  const [showTime, setShowTime] = useState(false)

  const displayName = isSelf
    ? (msg.senderName || 'You')
    : (msg.senderName || peerDisplayName || truncatePeerId(msg.sender))

  const contentHtml = isSelf
    ? Markdown.escapeHtml(msg.text || '')
    : Markdown.render(msg.text || '')

  return (
    <div
      className={`message msg-p2p ${isSelf ? 'msg-p2p-self msg-user' : 'msg-assistant'}`}
      data-msg-id={msg.id}
      onClick={() => setShowTime(prev => !prev)}
    >
      <div className="msg-sender">{displayName}</div>
      {msg.attachment && <AttachmentView attachment={msg.attachment} />}
      {msg.text && (
        <div className="msg-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      )}
      <div className={`msg-time${showTime ? ' visible' : ''}`}>
        {formatTime(msg.timestamp)}
      </div>
    </div>
  )
}
