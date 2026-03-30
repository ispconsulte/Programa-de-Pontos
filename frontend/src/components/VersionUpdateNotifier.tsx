import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { APP_VERSION, fetchRemoteAppVersion } from '@/lib/app-version'
import { Button } from '@/components/ui/button'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

export default function VersionUpdateNotifier() {
  const [nextVersion, setNextVersion] = useState<string | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const checkVersion = async () => {
      try {
        const remoteVersion = await fetchRemoteAppVersion()
        if (cancelled || !remoteVersion || remoteVersion === APP_VERSION) {
          return
        }

        setNextVersion((current) => current ?? remoteVersion)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Version check unavailable:', error)
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion()
      }
    }

    void checkVersion()

    const intervalId = window.setInterval(() => {
      void checkVersion()
    }, VERSION_CHECK_INTERVAL_MS)

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (!nextVersion || dismissedVersion === nextVersion) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(calc(100%-2rem),26rem)] rounded-2xl border border-emerald-500/20 bg-[hsl(var(--surface-1))] p-4 shadow-2xl shadow-black/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <RefreshCw className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Nova versao disponivel</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Encontramos uma atualizacao do sistema. Clique em atualizar para carregar a versao mais recente.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="success"
              onClick={() => window.location.reload()}
            >
              Atualizar agora
            </Button>
            <Button
              variant="outline"
              className="border-[hsl(var(--border))]"
              onClick={() => setDismissedVersion(nextVersion)}
            >
              Depois
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
