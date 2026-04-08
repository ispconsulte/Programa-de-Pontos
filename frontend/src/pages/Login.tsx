import { useState, FormEvent, useEffect, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logoPrincipal from '@/assets/logo-principal.png'

/* ── Floating reward particles ── */
function RewardParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      duration: 12 + Math.random() * 10,
      color: i % 4 === 0
        ? 'hsl(45 90% 55% / 0.25)'
        : i % 4 === 1
          ? 'hsl(217 91% 60% / 0.18)'
          : i % 4 === 2
            ? 'hsl(30 70% 50% / 0.15)'
            : 'hsl(0 75% 55% / 0.12)',
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
            boxShadow: `0 0 ${p.size * 5}px ${p.color}`,
            animation: `loginFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/* ── Rotating motivational messages ── */
const motivationalMessages = [
  '💰 Manter suas contas em dia gera recompensas!',
  '🎁 Seja um bom pagador e desfrute de benefícios constantes!',
  '⭐ Pontue a cada pagamento e troque por prêmios incríveis!',
  '🚀 Quanto antes você pagar, mais pontos você ganha!',
  '🏆 Clientes fiéis são sempre recompensados!',
]

function RotatingMessageCard({ mounted }: { mounted: boolean }) {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % motivationalMessages.length)
        setFade(true)
      }, 400)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="w-full max-w-[380px]"
      style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 700ms ease 550ms' }}
    >
      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.04] px-5 py-4 backdrop-blur-sm">
        <div className="pointer-events-none absolute -top-px left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 flex-shrink-0 text-primary/60" />
          <p
            className="text-[13px] font-medium leading-relaxed text-foreground/70 transition-opacity duration-400"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {motivationalMessages[index]}
          </p>
        </div>
      </div>
    </div>
  )
}

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

  return (
    <div className="login-page relative flex min-h-[100dvh] overflow-hidden">
      {/* ── Full-screen unified background ── */}
      <div className="absolute inset-0 bg-[linear-gradient(145deg,hsl(230,35%,3%)_0%,hsl(225,30%,5%)_30%,hsl(220,28%,6%)_60%,hsl(230,25%,4%)_100%)]" />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -left-[10%] top-[5%] h-[500px] w-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, hsl(0 75% 50% / 0.08) 0%, transparent 60%)', animation: 'loginGlowDrift 20s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute -bottom-[10%] right-[5%] h-[450px] w-[450px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(45 90% 55% / 0.06) 0%, transparent 55%)', animation: 'loginGlowDrift 26s ease-in-out 3s infinite reverse' }} />
      <div className="pointer-events-none absolute left-[40%] top-[15%] h-[350px] w-[350px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.05) 0%, transparent 50%)', animation: 'loginGlowDrift 18s ease-in-out 6s infinite' }} />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: 'linear-gradient(hsl(217 91% 60% / 0.12) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.12) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

      {/* Top accent */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

      <RewardParticles />

      {/* ── Main 50/50 layout ── */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 md:flex-row md:items-center md:justify-center md:gap-0">

        {/* ── LEFT: Hero/Brand ── */}
        <div
          className="flex w-full max-w-[460px] flex-col items-center px-4 pb-8 md:w-1/2 md:max-w-none md:items-center md:justify-center md:px-8 md:pb-0 lg:px-12 xl:px-16"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 3D Animated Logo */}
          <div
            className="mb-6 md:mb-8"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.85)', transition: 'all 1000ms cubic-bezier(0.16, 1, 0.3, 1) 100ms' }}
          >
            <div className="relative" style={{ perspective: '1000px' }}>
              {/* Glow */}
              <div className="absolute inset-[-25%] rounded-full blur-3xl"
                style={{
                  background: 'radial-gradient(circle, hsl(0 80% 50% / 0.12) 0%, hsl(45 90% 55% / 0.06) 40%, transparent 70%)',
                  animation: 'loginHeroGlow 4s ease-in-out infinite',
                }} />
              {/* Floor shadow */}
              <div className="absolute -bottom-3 left-[20%] right-[20%] h-6 rounded-[50%] opacity-25 blur-xl"
                style={{ background: 'radial-gradient(ellipse, hsl(0 0% 0% / 0.5), transparent 70%)' }} />
              <img
                src={logoPrincipal}
                alt="Bonifica - Plataforma de Recompensas"
                className="relative w-[180px] object-contain sm:w-[220px] md:w-[260px] lg:w-[300px]"
                style={{
                  filter: 'drop-shadow(0 16px 32px hsl(0 0% 0% / 0.35)) drop-shadow(0 0 20px hsl(0 75% 50% / 0.1))',
                  animation: mounted ? 'loginHero3DFloat 6s ease-in-out infinite' : 'none',
                  transformStyle: 'preserve-3d',
                }}
              />
            </div>
          </div>

          {/* Subtitle */}
          <p
            className="mb-6 max-w-[320px] text-center text-[clamp(0.8rem,2vw,0.9rem)] leading-relaxed text-muted-foreground/50 md:mb-8"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 700ms ease 400ms' }}
          >
            Sua plataforma completa de fidelização, pontuação e recompensas.
          </p>

          {/* Tier cards */}
          <div
            className="flex flex-wrap items-center justify-center gap-3 md:gap-4"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 700ms ease 550ms' }}
          >
            {tiers.map((tier) => {
              const Icon = tier.icon
              return (
                <div
                  key={tier.name}
                  className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.04]"
                  style={{ borderColor: tier.border, background: tier.bg }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tier.color.replace(')', ' / 0.15)')}` }}>
                    <Icon className="h-4 w-4" style={{ color: tier.color }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: tier.color }}>{tier.name}</p>
                    <p className="text-[10px] text-muted-foreground/40">{tier.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Login Form ── */}
        <div
          className="w-full max-w-[420px] px-4 md:w-1/2 md:max-w-none md:flex md:items-center md:justify-center md:px-8 lg:px-12 xl:px-16"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1) 250ms' }}
        >
          <div className="w-full max-w-[400px]">
            {/* Glass card */}
            <div className="login-card relative rounded-2xl border border-foreground/[0.06] bg-[hsl(225_25%_7.5%_/_0.65)] p-6 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.5),0_0_0_1px_hsl(217_91%_60%_/_0.04)] backdrop-blur-xl sm:p-7 lg:p-8">
              {/* Top glow */}
              <div className="pointer-events-none absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="mb-6">
                <h2 className="text-[clamp(1.15rem,3vw,1.35rem)] font-bold tracking-tight text-foreground">
                  Acesse seu painel
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/50">
                  Seus pontos e recompensas estão te esperando.
                </p>
              </div>

              {registered && (
                <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]" />
                  <p className="text-[13px] text-foreground">Conta criada. Faça login para continuar.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-[13px] text-foreground">{error}</p>
                  </div>
                )}

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

            <p className="mt-5 text-center text-[13px] text-muted-foreground/40">
              Não tem conta?{' '}
              <Link to="/register" className="font-medium text-primary/80 transition-colors hover:text-primary">
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
