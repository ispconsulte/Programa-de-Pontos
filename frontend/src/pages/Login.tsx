import { useState, FormEvent, useEffect, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Star, Crown, Gem } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logoPrincipal from '@/assets/logo-principal.png'

/* ── Floating particles (memoized) ── */
function AmbientParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 14,
      color: i % 5 === 0
        ? 'hsl(217 91% 60% / 0.2)'
        : i % 5 === 1
          ? 'hsl(48 96% 58% / 0.18)'
          : i % 5 === 2
            ? 'hsl(260 70% 60% / 0.15)'
            : i % 5 === 3
              ? 'hsl(160 70% 48% / 0.12)'
              : 'hsl(340 80% 55% / 0.1)',
    })), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            animation: `loginFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

const tiers = [
  { name: 'Bronze', icon: Star, accent: 'hsl(30 70% 50%)' },
  { name: 'Prata', icon: Gem, accent: 'hsl(220 20% 70%)' },
  { name: 'Ouro', icon: Crown, accent: 'hsl(45 95% 55%)' },
]

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
        await supabase.functions.invoke('bootstrap-tenant', { body: {} })
      } catch { /* edge function unreachable - ok */ }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const d = (ms: number) => ({ transitionDelay: `${ms}ms` })

  return (
    <div className="login-page relative flex min-h-[100dvh] flex-col overflow-hidden">
      {/* ── Unified full-screen background ── */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(230,35%,3%)_0%,hsl(225,30%,5%)_25%,hsl(220,28%,7%)_50%,hsl(230,25%,4%)_100%)]" />

      {/* Large ambient orbs */}
      <div className="pointer-events-none absolute -left-[15%] -top-[10%] h-[600px] w-[600px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.10) 0%, transparent 60%)', animation: 'loginGlowDrift 22s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute -bottom-[8%] right-[10%] h-[500px] w-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(260 70% 55% / 0.08) 0%, transparent 55%)', animation: 'loginGlowDrift 28s ease-in-out 4s infinite reverse' }} />
      <div className="pointer-events-none absolute right-[30%] top-[20%] h-[300px] w-[300px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, hsl(48 96% 55% / 0.06) 0%, transparent 50%)', animation: 'loginGlowDrift 18s ease-in-out 8s infinite' }} />

      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: 'linear-gradient(hsl(217 91% 60% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.15) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

      {/* Top accent line */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

      <AmbientParticles />

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-8 md:flex-row md:items-center md:justify-center md:gap-10 lg:gap-20 xl:gap-28">

        {/* ── LEFT: Brand / Hero area with 3D animated logo ── */}
        <div
          className="mb-10 flex w-full max-w-[400px] flex-col items-center text-center md:mb-0 md:w-auto md:max-w-[480px] md:items-center md:text-center lg:max-w-[520px]"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 3D Animated Logo */}
          <div
            className="login-hero-3d mb-8 transition-all duration-[1200ms] md:mb-10"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1) perspective(800px) rotateY(0deg)' : 'scale(0.7) perspective(800px) rotateY(-15deg)', ...d(100) }}
          >
            <div className="relative" style={{ perspective: '1000px' }}>
              {/* Glow behind the logo */}
              <div className="absolute inset-[-20%] rounded-full blur-3xl"
                style={{
                  background: 'radial-gradient(circle, hsl(0 80% 50% / 0.15) 0%, hsl(217 91% 60% / 0.08) 40%, hsl(48 96% 58% / 0.05) 70%, transparent 100%)',
                  animation: 'loginHeroGlow 4s ease-in-out infinite',
                }} />
              
              {/* Shadow on the "floor" */}
              <div className="absolute -bottom-4 left-[15%] right-[15%] h-8 rounded-[50%] opacity-30 blur-xl"
                style={{ background: 'radial-gradient(ellipse, hsl(0 0% 0% / 0.6), transparent 70%)' }} />

              {/* Main 3D image */}
              <img
                src={logoPrincipal}
                alt="Plataforma de Recompensas"
                className="relative w-[220px] object-contain sm:w-[260px] md:w-[300px] lg:w-[340px]"
                style={{
                  filter: 'drop-shadow(0 20px 40px hsl(0 0% 0% / 0.4)) drop-shadow(0 0 30px hsl(217 91% 60% / 0.15))',
                  animation: mounted ? 'loginHero3DFloat 6s ease-in-out infinite' : 'none',
                  transformStyle: 'preserve-3d',
                }}
              />
            </div>
          </div>

          {/* Headline */}
          <h1
            className="mb-3 text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-[1.15] tracking-tight text-foreground transition-all duration-700"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', ...d(350) }}
          >
            Fidelize.{' '}
            <span className="bg-gradient-to-r from-primary via-[hsl(48,96%,62%)] to-[hsl(260,70%,60%)] bg-clip-text text-transparent">
              Recompense.
            </span>
            <br className="hidden sm:block" />
            {' '}Cresça.
          </h1>

          <p
            className="mb-6 max-w-[340px] text-[clamp(0.8rem,2vw,0.875rem)] leading-relaxed text-muted-foreground/60 transition-all duration-700 md:mb-8"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', ...d(500) }}
          >
            A plataforma completa de fidelização e pontuação para o seu negócio.
          </p>

          {/* Tier badges */}
          <div
            className="flex items-center gap-4 transition-all duration-700 md:gap-5"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', ...d(650) }}
          >
            {tiers.map((tier, i) => {
              const Icon = tier.icon
              return (
                <div key={tier.name} className="flex items-center gap-4 md:gap-5">
                  {i > 0 && <div className="h-3.5 w-px bg-foreground/[0.08]" />}
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color: tier.accent, opacity: 0.75 }} />
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-foreground/40 md:text-[11px]">{tier.name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Login form ── */}
        <div
          className="w-full max-w-[400px] md:w-[380px] lg:w-[400px]"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1) 200ms' }}
        >
          {/* Glass card */}
          <div className="login-card relative rounded-2xl border border-foreground/[0.06] bg-[hsl(225_25%_7.5%_/_0.6)] p-6 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.5),0_0_0_1px_hsl(217_91%_60%_/_0.04)] backdrop-blur-xl sm:p-7 lg:p-8">
            {/* Subtle top glow on card */}
            <div className="pointer-events-none absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Card header */}
            <div className="mb-7">
              <h2 className="text-[clamp(1.15rem,3vw,1.35rem)] font-bold tracking-tight text-foreground">
                Acesse seu painel
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/55">
                Seus pontos e recompensas estão te esperando.
              </p>
            </div>

            {/* Success banner */}
            {registered && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]" />
                <p className="text-[13px] text-foreground">Conta criada. Faça login para continuar.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-[13px] text-foreground">{error}</p>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@empresa.com"
                  autoComplete="email"
                  className="h-[46px] rounded-xl border-foreground/[0.06] bg-foreground/[0.03] px-4 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/30 focus-visible:bg-foreground/[0.05] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
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
                    className="h-[46px] rounded-xl border-foreground/[0.06] bg-foreground/[0.03] px-4 pr-11 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/30 focus-visible:bg-foreground/[0.05] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/35 transition-all duration-150 hover:bg-foreground/[0.06] hover:text-foreground/60"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1" />

              {/* CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-[hsl(230,80%,58%)] text-[14px] font-semibold text-primary-foreground shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_6px_24px_-6px_hsl(var(--primary)_/_0.4)] transition-all duration-200 hover:shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_10px_32px_-4px_hsl(var(--primary)_/_0.5)] hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(225,30%,6%)] active:scale-[0.985] active:brightness-[0.96] disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                <span className="relative">{loading ? 'Entrando...' : 'Entrar'}</span>
                {loading
                  ? <Spinner size="sm" />
                  : <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                }
              </button>
            </form>
          </div>

          {/* Register link */}
          <p className="mt-5 text-center text-[13px] text-muted-foreground/45">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-primary/80 transition-colors hover:text-primary">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
