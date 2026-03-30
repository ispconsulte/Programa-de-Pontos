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
        {/* Ambient glow (mobile) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,hsl(217_91%_60%_/_0.03),transparent_65%)] lg:hidden" />

        <div className="relative z-10 w-full max-w-[400px]">
          {/* ── Mobile-only logo ── */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <LogoAnimated src={logoBonifica} alt="Logo Bonifica" size={110} />
          </div>

          {/* ── Form container ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-2)_/_0.5)] p-7 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)] lg:p-8">
            {/* Header inside card */}
            <div className="mb-7">
               <h1 className="font-heading text-[24px] font-bold tracking-tight text-foreground">
                Acesse seu painel
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Seus pontos e recompensas estão te esperando.
              </p>
            </div>

            {/* Registered banner */}
            {registered && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                <p className="text-[13px] text-emerald-300">Conta criada. Faça login para continuar.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-[13px] text-red-300">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@empresa.com"
                  autoComplete="email"
                  className="h-11 rounded-xl border-white/[0.1] bg-white/[0.03] px-4 text-[14px] placeholder:text-muted-foreground/30 focus-visible:border-primary/50 focus-visible:bg-white/[0.04]"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-white/[0.1] bg-white/[0.03] px-4 pr-11 text-[14px] placeholder:text-muted-foreground/30 focus-visible:border-primary/50 focus-visible:bg-white/[0.04]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Separator */}
              <div className="pt-1" />

              {/* CTA */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)),0_4px_24px_-4px_hsl(var(--primary)_/_0.4)] transition-all duration-200 hover:shadow-[0_0_0_1px_hsl(var(--primary)),0_8px_32px_-4px_hsl(var(--primary)_/_0.5)] hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative text-[14px]">
                  {loading ? 'Entrando...' : 'Entrar'}
                </span>
                {loading
                  ? <Spinner size="sm" />
                  : <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                }
              </button>
            </form>

            {/* Divider */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">ou</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            {/* Secondary action */}
            <p className="mt-4 text-center text-[13px] text-muted-foreground/60">
              Ainda não tem uma conta?{' '}
              <Link to="/register" className="font-medium text-primary/80 transition-colors hover:text-primary">
                Criar conta
              </Link>
            </p>
          </div>

          {/* Branding */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/30">
            <span>Powered by</span>
            <span className="font-semibold text-muted-foreground/50">Bonifica</span>
          </div>
        </div>
      </div>
    </div>
  )
}
