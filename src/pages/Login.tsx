import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import LogoAnimated from '@/components/LogoAnimated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logoBonifica from '@/assets/logo-bonifica.png'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [registered, setRegistered] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRegistered(searchParams.get('registered') === '1')
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('E-mail é obrigatório.')
      return
    }
    if (!password.trim()) {
      setError('Senha é obrigatória.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !data.session?.access_token) {
        setError(signInError?.message || 'Credenciais inválidas.')
        return
      }

      try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.warn('Tenant bootstrap failed:', body.error || res.status)
        }
      } catch (bootstrapErr) {
        console.warn('Tenant bootstrap unreachable:', bootstrapErr)
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message || 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — Brand showcase */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(225,35%,3%)] via-[hsl(225,30%,5%)] to-[hsl(230,28%,4%)]" />

        {/* Animated blobs */}
        <div
          className="absolute opacity-60"
          style={{
            width: 500, height: 500, top: '-10%', left: '-10%',
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'bgDrift 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute opacity-40"
          style={{
            width: 400, height: 400, bottom: '-5%', right: '-8%',
            background: 'radial-gradient(circle, hsl(217 80% 55% / 0.1) 0%, transparent 65%)',
            borderRadius: '50%',
            animation: 'bgDrift 16s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute opacity-30"
          style={{
            width: 250, height: 250, top: '40%', right: '20%',
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 60%)',
            borderRadius: '50%',
            animation: 'bgDrift 9s ease-in-out infinite',
            animationDelay: '-4s',
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top accent line */}
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative z-10 flex w-full max-w-[540px] flex-col items-center px-8">
          {/* Animated Logo */}
          <div className="mb-6">
            <LogoAnimated src={logoBonifica} size={320} />
          </div>

          <h2 className="text-center text-[30px] font-bold leading-[1.15] tracking-tight text-foreground">
            Gestão inteligente<br />
            <span className="bg-gradient-to-r from-primary to-[hsl(217,90%,72%)] bg-clip-text text-transparent">
              de bonificações
            </span>
          </h2>
          <p className="mt-4 max-w-[380px] text-center text-[14px] leading-relaxed text-muted-foreground">
            Acompanhe pontuações, gerencie recompensas e fidelize seus clientes com uma plataforma pensada para resultados.
          </p>

        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="relative flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-12 xl:px-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,_rgba(59,130,246,0.03)_0%,_transparent_60%)] lg:bg-none" />

        <div className="relative z-10 w-full max-w-[500px] xl:max-w-[540px]">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <img src={logoBonifica} alt="Logo Bonifica" className="h-14 w-14 object-contain animate-float" />
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white font-heading">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">Entre com suas credenciais para continuar.</p>
          </div>

          {registered && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-300">Conta criada. Faça login para continuar.</p>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-[hsl(var(--surface-1))] p-6 lg:p-8 shadow-xl shadow-black/10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Spinner size="sm" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-primary transition-colors hover:text-primary/80">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
