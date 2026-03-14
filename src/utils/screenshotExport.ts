// Screenshot export utilities

/**
 * Export current canvas frame as PNG download.
 */
export function exportCanvasScreenshot(canvas: HTMLCanvasElement, filename = 'dom2-screenshot.png') {
  const dataUrl = canvas.toDataURL('image/png')
  downloadDataUrl(dataUrl, filename)
}

/**
 * Render conversation messages to an image and download.
 */
export function exportConversationImage(
  messages: Array<{ speakerName: string; content: string; emotion: string }>,
  title = 'DOM2 AI',
): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const padding = 20
  const lineHeight = 22
  const maxWidth = 400
  const headerHeight = 40

  canvas.width = maxWidth + padding * 2
  canvas.height = headerHeight + messages.length * lineHeight * 2 + padding * 3

  // Background
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Header
  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(title, padding, padding + 16)

  // Watermark
  ctx.fillStyle = '#4b5563'
  ctx.font = '10px monospace'
  ctx.fillText('DOM2 AI — big-brother-ai', padding, canvas.height - 10)

  // Messages
  let y = headerHeight + padding
  for (const msg of messages) {
    ctx.fillStyle = '#d1d5db'
    ctx.font = 'bold 12px monospace'
    ctx.fillText(`${msg.speakerName}:`, padding, y)
    y += lineHeight

    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px monospace'
    const words = msg.content.split(' ')
    let line = ''
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line.trim(), padding, y)
        y += lineHeight
        line = word + ' '
      } else {
        line = test
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), padding, y)
      y += lineHeight
    }
  }

  const dataUrl = canvas.toDataURL('image/png')
  return dataUrl
}

/**
 * Copy image data URL to clipboard.
 */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    return true
  } catch {
    return false
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
