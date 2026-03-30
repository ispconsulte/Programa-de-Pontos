import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import LogoAnimated from '@/components/LogoAnimated'
import LoginHero from '@/components/LoginHero'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setRegistered(searchParams.get('registered') === '1') }, [searchParams])
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

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
      <LoginHero />

      {/* ── Right: Form panel ── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[45%] lg:px-12 xl:px-16">
        {/* Subtle ambient wash */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,hsl(217_91%_60%_/_0.025),transparent_70%)]" />
        {/* Left edge accent (desktop) */}
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 hidden w-px bg-gradient-to-b from-transparent via-white/[0.04] to-transparent lg:block" />

        <div
          className="relative z-10 w-full max-w-[400px] transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)' }}
        >
          {/* ── Mobile logo ── */}
          <div className="mb-10 flex items-center justify-center lg:hidden">
            <LogoAnimated src={logoBonifica} alt="Logo Bonifica" size={110} />
          </div>

          {/* ── Card ── */}
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-2)_/_0.4)] p-7 shadow-[0_20px_60px_-16px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)] lg:p-8">
            {/* Card header */}
            <div className="mb-8">
              <h1 className="font-heading text-[22px] font-bold tracking-tight text-foreground">
                Acesse seu painel
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/80">
                Seus pontos e recompensas estão te esperando.
              </p>
            </div>

            {/* Success banner */}
            {registered && (
              <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                <p className="text-[13px] text-emerald-300">Conta criada. Faça login para continuar.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-[13px] text-red-300">{error}</p>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@empresa.com"
                  autoComplete="email"
                  className="h-[46px] rounded-xl border-[hsl(var(--border))] bg-white/[0.025] px-4 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/40 focus-visible:bg-[hsl(var(--surface-3))] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
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
                    className="h-[46px] rounded-xl border-[hsl(var(--border))] bg-white/[0.025] px-4 pr-11 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/40 focus-visible:bg-[hsl(var(--surface-3))] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/40 transition-all duration-150 hover:bg-[hsl(var(--muted))] hover:text-foreground/70"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Spacer */}
              <div className="pt-1.5" />

              {/* CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_4px_20px_-4px_hsl(var(--primary)_/_0.35)] transition-all duration-200 hover:shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_8px_28px_-4px_hsl(var(--primary)_/_0.45)] hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985] active:brightness-[0.96] disabled:pointer-events-none disabled:opacity-50"
              >
                {/* Hover shine */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                <span className="relative">
                  {loading ? 'Entrando...' : 'Entrar'}
                </span>
                {loading
                  ? <Spinner size="sm" />
                  : <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                }
              </button>
            </form>

            {/* Subtle footer */}
            <p className="mt-7 text-center text-[11px] text-muted-foreground/30">
              Precisa de acesso?{' '}
              <Link to="/register" className="text-muted-foreground/45 underline underline-offset-2 transition-colors hover:text-muted-foreground/65">
                Fale com o administrador
              </Link>
            </p>
          </div>

          {/* Trust signal + branding */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/25">
              <Shield className="h-3 w-3" />
              <span>Conexão segura e criptografada</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/20">
              <span>Powered by</span>
              <span className="font-semibold text-muted-foreground/35">Bonifica</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
