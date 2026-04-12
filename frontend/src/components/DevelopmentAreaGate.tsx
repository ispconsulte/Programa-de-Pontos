import { FormEvent, useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clearDevelopmentAreaAccess, hasDevelopmentAreaAccess, unlockDevelopmentArea } from '@/lib/dev-area-access'
import { supabase } from '@/lib/supabase-client'

interface DevelopmentAreaGateProps {
  area: 'codano' | 'contas'
  title: string
  children: React.ReactNode
}

export default function DevelopmentAreaGate({
  area,
  title,
  children,
}: DevelopmentAreaGateProps) {
  const [checking, setChecking] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadAccess = async () => {
      try {
        const allowed = await hasDevelopmentAreaAccess(area)
        if (!mounted) return
        setUnlocked(allowed)
      } finally {
        if (mounted) {
          setChecking(false)
        }
      }
    }

    void loadAccess()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        clearDevelopmentAreaAccess()
        if (!mounted) return
        setUnlocked(false)
        setPassword('')
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [area])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await unlockDevelopmentArea(area, password)
      setUnlocked(true)
      setPassword('')
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Senha inválida.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <LockKeyhole className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle>Área protegida</CardTitle>
            <CardDescription>
              Digite a senha compartilhada para acessar {title}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <AlertBanner variant="error" message={error} />}
            <div className="space-y-2">
              <Label htmlFor={`dev-area-password-${area}`}>Senha</Label>
              <Input
                id={`dev-area-password-${area}`}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={submitting || !password.trim()} className="w-full">
              {submitting ? <Spinner size="sm" /> : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
