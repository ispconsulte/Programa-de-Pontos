import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/* ── Animated waving hand ──────────────────────────────────────────────── */
function WavingHand() {
  return (
    <span
      className="inline-block text-4xl origin-[70%_80%]"
      style={{
        animation: 'wave 1.8s ease-in-out infinite',
      }}
    >
      👋
      <style>{`
        @keyframes wave {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-8deg); }
          30%  { transform: rotate(14deg); }
          40%  { transform: rotate(-4deg); }
          50%  { transform: rotate(10deg); }
          60%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </span>
  )
}

/* ── Props ─────────────────────────────────────────────────────────────── */
interface WelcomeModalProps {
  /** Unique key for sessionStorage (e.g. 'admin-welcome' or 'operator-welcome') */
  storagePrefix: string
  /** User display name */
  userName?: string
  /** Modal body – the tip/message */
  message: React.ReactNode
}

export default function WelcomeModal({ storagePrefix, userName, message }: WelcomeModalProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const key = `${storagePrefix}-${new Date().toISOString().slice(0, 10)}`
    if (!sessionStorage.getItem(key)) {
      setOpen(true)
    }
  }, [storagePrefix])

  const dismiss = () => {
    setOpen(false)
    const key = `${storagePrefix}-${new Date().toISOString().slice(0, 10)}`
    try { sessionStorage.setItem(key, '1') } catch { /* ignore */ }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <WavingHand />
            <DialogTitle className="text-lg">
              {greeting}{userName ? `, ${userName}` : ''}!
            </DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {message}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={dismiss} size="sm">
            Entendi, obrigado! 👍
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
