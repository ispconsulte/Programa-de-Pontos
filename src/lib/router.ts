export function shouldUseHashRouter() {
  if (typeof window === 'undefined') return false

  try {
    if (window.self !== window.top) {
      return true
    }
  } catch {
    return true
  }

  return import.meta.env.VITE_ROUTER_MODE === 'hash'
}
