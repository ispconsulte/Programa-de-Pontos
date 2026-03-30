import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const APP_NAVIGATE_EVENT = 'app:navigate'

export interface AppNavigateDetail {
  to: string
  replace?: boolean
}

export function emitAppNavigate(detail: AppNavigateDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AppNavigateDetail>(APP_NAVIGATE_EVENT, { detail }))
}

export default function NavigationEventBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const detail = (event as CustomEvent<AppNavigateDetail>).detail
      if (!detail?.to) return
      navigate(detail.to, { replace: detail.replace ?? false })
    }

    window.addEventListener(APP_NAVIGATE_EVENT, handleNavigation)
    return () => {
      window.removeEventListener(APP_NAVIGATE_EVENT, handleNavigation)
    }
  }, [navigate])

  return null
}
