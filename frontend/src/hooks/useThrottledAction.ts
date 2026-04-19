import { useCallback, useRef, useState } from 'react'

const COOLDOWN_MS = 2000

/**
 * Wraps an async action with loading state + cooldown to prevent spam clicks.
 * Returns `[wrappedFn, busy]` where `busy` is true while running or cooling down.
 */
export function useThrottledAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
  cooldownMs = COOLDOWN_MS,
) {
  const [busy, setBusy] = useState(false)
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(async (...args: TArgs) => {
    if (busy) return
    setBusy(true)
    try {
      await action(...args)
    } finally {
      cooldownRef.current = setTimeout(() => {
        setBusy(false)
        cooldownRef.current = null
      }, cooldownMs)
    }
  }, [action, busy, cooldownMs])

  return [run, busy] as const
}
