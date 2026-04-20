import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw, X } from 'lucide-react'
import { APP_VERSION, fetchRemoteAppVersion } from '@/lib/app-version'
import { Button } from '@/components/ui/button'
import { createButtonGuard } from '@/utils/antiFlood'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000
const RESTORE_KEY = 'bonifica-restore-route'
const DISMISSED_KEY = 'bonifica-dismissed-version'

/**
 * Non-intrusive version update notifier.
 * - Shows a toast when a new version is detected
 * - User can dismiss ("Mais tarde") or update now
 * - On "Atualizar agora": saves current route + scroll, reloads, then restores
 * - Never kicks the user out or interrupts their workflow
 */
export default function VersionUpdateNotifier() {
  const location = useLocation()
  const [nextVersion, setNextVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const updateGuardRef = useRef(createButtonGuard('version-update-now'))
  const versionCheckInFlightRef = useRef(false)

  // On mount, check if we need to restore a route after reload
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESTORE_KEY)
      if (raw) {
        sessionStorage.removeItem(RESTORE_KEY)
        const restore = JSON.parse(raw) as { path?: string; scrollY?: number }
        if (restore.path && restore.path !== window.location.pathname) {
          // Use replaceState to avoid extra history entry
          window.history.replaceState(null, '', restore.path)
          // Small delay to let React Router pick up the new URL
          requestAnimationFrame(() => {
            window.scrollTo(0, restore.scrollY ?? 0)
          })
        } else if (restore.scrollY) {
          requestAnimationFrame(() => window.scrollTo(0, restore.scrollY ?? 0))
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Check if this version was already dismissed
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(DISMISSED_KEY)
      if (v && nextVersion && v === nextVersion) {
        setDismissed(true)
      }
    } catch { /* ignore */ }
  }, [nextVersion])

  // Poll for new versions
  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null

    const checkVersion = async () => {
      if (versionCheckInFlightRef.current) return
      versionCheckInFlightRef.current = true
      controller = new AbortController()
      try {
        const remoteVersion = await fetchRemoteAppVersion(controller.signal)
        if (cancelled || !remoteVersion || remoteVersion === APP_VERSION) return
        setNextVersion(remoteVersion)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // silently ignore
      } finally {
        versionCheckInFlightRef.current = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkVersion()
    }

    void checkVersion()
    const interval = window.setInterval(() => void checkVersion(), VERSION_CHECK_INTERVAL_MS)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const handleUpdateNow = useCallback(() => {
    if (updating || !updateGuardRef.current.canExecute()) return
    setUpdating(true)
    // Save where the user is so we can restore after reload
    try {
      sessionStorage.setItem(
        RESTORE_KEY,
        JSON.stringify({
          path: location.pathname + location.search + location.hash,
          scrollY: window.scrollY,
        })
      )
    } catch { /* ignore */ }

    window.location.reload()
  }, [location, updating])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    if (nextVersion) {
      try { sessionStorage.setItem(DISMISSED_KEY, nextVersion) } catch { /* ignore */ }
    }
  }, [nextVersion])

  if (!nextVersion || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(calc(100%-2rem),26rem)] rounded-2xl border border-primary/15 bg-[hsl(var(--surface-1))] p-5 shadow-2xl shadow-black/30 animate-enter">
      {/* Close X */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <span className="text-lg">🎁</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Novidades para você! ✨</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Preparamos melhorias para sua experiência. Atualize quando quiser — você não perderá o que está fazendo.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="default" size="sm" onClick={handleUpdateNow} disabled={updating} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              {updating ? 'Aguarde...' : 'Atualizar agora'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              Mais tarde
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
