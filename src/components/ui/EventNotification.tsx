'use client'

import { useEffect, useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'

interface Toast {
  id: string
  message: string
  createdAt: number
}

export default function EventNotification() {
  const dramaAlerts = useSimulationStore(s => s.dramaAlerts)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    if (dramaAlerts.length === 0) return
    const latest = dramaAlerts[dramaAlerts.length - 1]

    setToasts(prev => {
      // Avoid duplicates
      if (prev.some(t => t.id === latest.id)) return prev
      const newToast: Toast = {
        id: latest.id,
        message: latest.message,
        createdAt: Date.now(),
      }
      return [...prev.slice(-4), newToast]
    })
  }, [dramaAlerts])

  // Auto-remove old toasts
  useEffect(() => {
    const timer = setInterval(() => {
      setToasts(prev => prev.filter(t => Date.now() - t.createdAt < 8000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-gray-900/95 border border-yellow-600/50 text-yellow-200 px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in max-w-md text-center"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
