import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import LogoAnimated from '@/components/LogoAnimated'
import LoginHero from '@/components/LoginHero'
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
    if (!email.trim()) { setError('E-mail é obrigatório.'); return }
    if (!password.trim()) { setError('Senha é obrigatória.'); return }

    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !data.session?.access_token) { setError(signInError?.message || 'Credenciais inválidas.'); return }

      try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({}),
        })
        if (!res.ok) { const body = await res.json().catch(() => ({})); console.debug('Tenant bootstrap failed:', body.error || res.status) }
      } catch { /* backend unreachable */ }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left: Visual hero (55%) ── */}
      <LoginHero />

      {/* ── Right: Login form (45%) ── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[45%] lg:px-10 xl:px-16">
        {/* Subtle ambient glow for mobile */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,hsl(217_91%_60%_/_0.03),transparent_65%)] lg:hidden" />

        <div className="relative z-10 w-full max-w-[420px]">
          {/* ── Mobile-only logo ── */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <LogoAnimated src={logoBonifica} alt="Logo Bonifica" size={110} />
          </div>

          {/* ── Header ── */}
          <div className="mb-8">
            <h1 className="font-heading text-[22px] font-bold tracking-tight text-foreground">
              Bem-vindo de volta
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Entre com suas credenciais para acessar sua conta.
            </p>
          </div>

          {/* ── Registered success ── */}
          {registered && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              <p className="text-[13px] text-emerald-300">Conta criada com sucesso. Faça login para continuar.</p>
            </div>
          )}

          {/* ── Form card ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--surface-1))] p-6 shadow-2xl shadow-black/8 lg:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error alert */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3.5 py-2.5 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-[13px] text-red-300">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Spinner size="sm" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </div>

          {/* ── Footer link ── */}
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-primary transition-colors hover:text-primary/80">
              Criar conta
            </Link>
          </p>

          {/* ── Bottom branding ── */}
          <div className="mt-10 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40">
            <span>Powered by</span>
            <span className="font-semibold text-muted-foreground/60">Bonifica</span>
          </div>
        </div>
      </div>
    </div>
  )
}
