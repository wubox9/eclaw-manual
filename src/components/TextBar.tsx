import { forwardRef, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import type { ChatAttachment } from '../lib/types'

interface CompressedImage {
  readonly base64: string
  readonly mimeType: string
}

function compressImage(file: File, maxDim = 1920, quality = 0.7): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
        else { w = Math.round(w * maxDim / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const base64 = dataUrl.split(',')[1]
      if (!base64) { reject(new Error('Compress failed')); return }
      resolve({ base64, mimeType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')) }
    img.src = url
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      if (!base64) { reject(new Error('Read failed')); return }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

const TextBar = forwardRef<HTMLDivElement>(function TextBar(_props, ref) {
  const { textInputVisible, sendMessage, showToast, chatMode } = useApp()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const autoResize = useCallback(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
  }, [])

  const handleSend = useCallback(() => {
    if (!inputRef.current) return
    const text = inputRef.current.value.trim()
    if (!text) return
    sendMessage(text)
    inputRef.current.value = ''
    autoResize()
    inputRef.current.focus()
    if (navigator.vibrate) navigator.vibrate(30)
  }, [sendMessage, autoResize])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isP2P = chatMode === 'p2p-dm'
    const maxSize = isP2P ? 50 * 1024 * 1024 : 20 * 1024 * 1024
    const maxLabel = isP2P ? '50 MB' : '20 MB'

    if (file.size > maxSize) {
      showToast(`File too large (max ${maxLabel})`)
      e.target.value = ''
      return
    }

    if (navigator.vibrate) navigator.vibrate(30)
    e.target.value = ''

    try {
      let attachment: ChatAttachment
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        const compressed = await compressImage(file)
        attachment = {
          mimeType: compressed.mimeType,
          fileName: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg',
          content: compressed.base64,
          _previewUrl: previewUrl
        }
      } else {
        const base64 = await readFileAsBase64(file)
        attachment = {
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name || 'file',
          content: base64
        }
      }
      const text = inputRef.current?.value.trim() ?? ''
      if (inputRef.current) { inputRef.current.value = ''; autoResize() }
      sendMessage(text, [attachment])
    } catch (err) {
      console.error('File processing failed:', err)
      showToast('Failed to process file')
    }
  }, [sendMessage, showToast, autoResize, chatMode])

  if (!textInputVisible) return null

  return (
    <footer ref={ref} className="text-bar">
      <button className="camera-btn" aria-label="Add file" onClick={() => fileInputRef.current?.click()}>
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>
      </button>
      <div className="input-wrapper">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Type a message..."
          rows={1}
          autoComplete="off"
          enterKeyHint="send"
          onInput={autoResize}
          onKeyDown={handleKeyDown}
        />
      </div>
      <button className="send-btn" aria-label="Send message" onClick={handleSend}>
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
      </button>
      <input ref={fileInputRef} type="file" className="file-input-hidden" onChange={handleFileChange} />
    </footer>
  )
})

export default TextBar
