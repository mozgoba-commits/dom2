'use client'

import { useState } from 'react'
import { copyImageToClipboard } from '../../utils/screenshotExport'

interface ShareModalProps {
  imageUrl: string
  onClose: () => void
}

export default function ShareModal({ imageUrl, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = 'dom2-moment.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCopy = async () => {
    const ok = await copyImageToClipboard(imageUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full mx-4 p-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3 text-center">Поделиться моментом</h3>

        {/* Preview */}
        <div className="bg-black rounded-lg overflow-hidden mb-4">
          <img src={imageUrl} alt="Screenshot" className="w-full" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Скачать
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
