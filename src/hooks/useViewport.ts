'use client'

import { useEffect } from 'react'
import { useViewStore } from '../store/viewStore'

export function useViewport() {
  const setMobile = useViewStore(s => s.setMobile)

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [setMobile])
}
