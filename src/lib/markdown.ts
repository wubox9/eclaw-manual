// markdown.ts — Lightweight Markdown renderer for chat messages

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code)
  const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : ''
  return `<pre class="code-block">${langLabel}<code>${escaped}</code></pre>`
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInline(text: string): string {
  let result = escapeHtml(text)

  const codePlaceholders: string[] = []
  result = result.replace(/`([^`]+)`/g, (_match: string, code: string) => {
    const idx = codePlaceholders.length
    codePlaceholders.push(`<code class="inline-code">${code}</code>`)
    return `\x00CODE${idx}\x00`
  })

  result = result.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.*?)__/g, '<strong>$1</strong>')
  result = result.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '<em>$1</em>')
  result = result.replace(/(?<!\w)_(.*?)_(?!\w)/g, '<em>$1</em>')
  result = result.replace(/~~(.*?)~~/g, '<del>$1</del>')

  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, linkText: string, url: string) => {
      const trimmed = url.trim()
      if (/^https?:\/\//i.test(trimmed)) {
        return `<a href="${escapeAttr(trimmed)}" target="_blank" rel="noopener">${linkText}</a>`
      }
      return _match
    }
  )

  result = result.replace(
    /(?<!["\w=])(https?:\/\/[^\s<]+)/g,
    (match: string, url: string, offset: number) => {
      const before = result.slice(0, offset)
      const lastOpenA = before.lastIndexOf('<a ')
      const lastCloseA = before.lastIndexOf('</a>')
      if (lastOpenA > lastCloseA) {
        return match
      }
      const trailingMatch = url.match(/[.,;:!?)]+$/)
      const cleanUrl = trailingMatch ? url.slice(0, -trailingMatch[0].length) : url
      const trailing = trailingMatch ? trailingMatch[0] : ''
      if (!cleanUrl) return match
      return `<a href="${escapeAttr(cleanUrl)}" target="_blank" rel="noopener">${cleanUrl}</a>${trailing}`
    }
  )

  result = result.replace(/\x00CODE(\d+)\x00/g, (_match: string, idx: string) => {
    return codePlaceholders[parseInt(idx, 10)] ?? _match
  })

  return result
}

function render(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const codeMatch = line.match(/^```(\w*)/)
    if (codeMatch) {
      const lang = codeMatch[1]
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push(renderCodeBlock(codeLines.join('\n'), lang))
      i++
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push('<hr>')
      i++
      continue
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push(`<blockquote>${render(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    if (/^[\s]*[-*+]\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        listItems.push(renderInline(lines[i].replace(/^[\s]*[-*+]\s/, '')))
        i++
      }
      const items = listItems.map(item => `<li>${item}</li>`).join('')
      blocks.push(`<ul>${items}</ul>`)
      continue
    }

    if (/^[\s]*\d+\.\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        listItems.push(renderInline(lines[i].replace(/^[\s]*\d+\.\s/, '')))
        i++
      }
      const items = listItems.map(item => `<li>${item}</li>`).join('')
      blocks.push(`<ol>${items}</ol>`)
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[\s]*[-*+]\s/.test(lines[i]) &&
      !/^[\s]*\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${renderInline(paraLines.join('\n'))}</p>`)
    }
  }

  return blocks.join('\n')
}

export const Markdown = { render, renderInline, escapeHtml } as const
