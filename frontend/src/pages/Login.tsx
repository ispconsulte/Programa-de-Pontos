import { useState, FormEvent, useEffect, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Trophy, TrendingUp, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logoPrincipal from '@/assets/logo-principal.png'

/* ── Floating reward particles (enhanced) ── */
function RewardParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 3.5,
      delay: Math.random() * 8,
      duration: 14 + Math.random() * 14,
      driftX: -20 + Math.random() * 40,
      color: i % 5 === 0
        ? 'hsl(45 90% 55% / 0.22)'
        : i % 5 === 1
          ? 'hsl(217 91% 60% / 0.16)'
          : i % 5 === 2
            ? 'hsl(30 70% 50% / 0.14)'
            : i % 5 === 3
              ? 'hsl(160 60% 45% / 0.12)'
              : 'hsl(0 75% 55% / 0.10)',
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
            boxShadow: `0 0 ${p.size * 6}px ${p.color}`,
            animation: `loginFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
            '--drift-x': `${p.driftX}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ── Animated aurora background ── */
function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Aurora wave 1 */}
      <div
        className="absolute -left-[30%] top-[10%] h-[60%] w-[160%] rounded-[50%] opacity-[0.04]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(217 91% 60%) 25%, hsl(45 90% 55%) 50%, hsl(160 60% 45%) 75%, transparent 100%)',
          filter: 'blur(80px)',
          animation: 'auroraWave1 18s ease-in-out infinite',
        }}
      />
      {/* Aurora wave 2 */}
      <div
        className="absolute -right-[20%] top-[35%] h-[50%] w-[140%] rounded-[50%] opacity-[0.03]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(0 75% 55%) 20%, hsl(45 90% 55%) 50%, hsl(217 91% 60%) 80%, transparent 100%)',
          filter: 'blur(100px)',
          animation: 'auroraWave2 22s ease-in-out 4s infinite',
        }}
      />
      {/* Coin shimmer lines */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute h-px opacity-[0.06]"
          style={{
            top: `${25 + i * 22}%`,
            left: '-10%',
            width: '120%',
            background: `linear-gradient(90deg, transparent 0%, hsl(45 90% 55% / 0.4) ${30 + i * 10}%, transparent ${60 + i * 5}%)`,
            animation: `shimmerLine ${8 + i * 3}s ease-in-out ${i * 2.5}s infinite`,
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

/* ── Reward info card ── */
const rewardCards = [
  { icon: Trophy, label: 'Pontuação', desc: 'Ganhe pontos a cada pagamento em dia', accent: 'hsl(45 90% 55%)' },
  { icon: TrendingUp, label: 'Fidelidade', desc: 'Suba de nível e desbloqueie vantagens', accent: 'hsl(217 91% 60%)' },
  { icon: Gift, label: 'Recompensas', desc: 'Troque seus pontos por prêmios reais', accent: 'hsl(160 60% 45%)' },
]

function RewardInfoCard({ icon: Icon, label, desc, accent, delay, mounted }: {
  icon: typeof Trophy; label: string; desc: string; accent: string; delay: number; mounted: boolean
}) {
  return (
    <div
      className="group relative flex h-[88px] w-[300px] items-center gap-4 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-[hsl(225_25%_8%_/_0.45)] px-5 backdrop-blur-md transition-all duration-300 hover:border-foreground/[0.1] hover:bg-[hsl(225_25%_9%_/_0.55)] hover:scale-[1.02] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.4)]"
      style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: `all 600ms ease ${delay}ms` }}
    >
      {/* Top glow line */}
      <div className="pointer-events-none absolute -top-px left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: `linear-gradient(to right, transparent, ${accent.replace(')', ' / 0.25)')}, transparent)` }} />
      {/* Icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        style={{ background: `linear-gradient(135deg, ${accent.replace(')', ' / 0.15)')}, ${accent.replace(')', ' / 0.05)')})` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: accent }} />
      </div>
      {/* Text */}
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground/80">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground/50">{desc}</p>
      </div>
    </div>
  )
}

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
      className="w-[300px]"
      style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)', transition: 'all 700ms ease 850ms' }}
    >
      <div className="group relative h-[64px] flex items-center justify-center overflow-hidden rounded-2xl border border-foreground/[0.06] bg-[hsl(225_25%_8%_/_0.45)] px-5 backdrop-blur-md transition-all duration-300 hover:border-foreground/[0.1] hover:bg-[hsl(225_25%_9%_/_0.55)] hover:scale-[1.02]">
        <div className="pointer-events-none absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        <p
          className="text-center text-[12px] font-medium leading-relaxed text-foreground/55 transition-opacity duration-500"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {motivationalMessages[index]}
        </p>
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

      {/* ── Main layout: 40/60 split ── */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 md:flex-row md:items-stretch md:gap-0 md:px-0 md:py-0">

        {/* ── LEFT: Visual / Brand (40%) ── */}
        <div
          className="hidden md:flex md:w-[38%] lg:w-[40%] flex-col items-center justify-center px-6 lg:px-10"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 3D Animated Logo */}
          <div
            className="mb-8"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.85)', transition: 'all 1000ms cubic-bezier(0.16, 1, 0.3, 1) 100ms' }}
          >
            <div className="relative" style={{ perspective: '1000px' }}>
              <div className="absolute inset-[-25%] rounded-full blur-3xl"
                style={{
                  background: 'radial-gradient(circle, hsl(0 80% 50% / 0.12) 0%, hsl(45 90% 55% / 0.06) 40%, transparent 70%)',
                  animation: 'loginHeroGlow 4s ease-in-out infinite',
                }} />
              <div className="absolute -bottom-3 left-[20%] right-[20%] h-6 rounded-[50%] opacity-25 blur-xl"
                style={{ background: 'radial-gradient(ellipse, hsl(0 0% 0% / 0.5), transparent 70%)' }} />
              <img
                src={logoPrincipal}
                alt="Bonifica - Plataforma de Recompensas"
                className="relative w-[200px] object-contain lg:w-[260px]"
                style={{
                  filter: 'drop-shadow(0 16px 32px hsl(0 0% 0% / 0.35)) drop-shadow(0 0 20px hsl(0 75% 50% / 0.1))',
                  animation: mounted ? 'loginHero3DFloat 6s ease-in-out infinite' : 'none',
                  transformStyle: 'preserve-3d',
                }}
              />
            </div>
          </div>

          {/* Reward info cards */}
          <div className="flex flex-col items-center gap-3">
            {rewardCards.map((card, i) => (
              <RewardInfoCard key={card.label} {...card} delay={450 + i * 120} mounted={mounted} />
            ))}
            <RotatingMessageCard mounted={mounted} />
          </div>
        </div>

        {/* ── RIGHT: Login Form (60%) ── */}
        <div
          className="flex w-full max-w-[480px] flex-col items-center justify-center px-4 md:w-[62%] lg:w-[60%] md:max-w-none md:px-8 lg:px-16 xl:px-24"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1) 250ms' }}
        >
          {/* Mobile-only logo */}
          <div
            className="mb-8 md:hidden"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.85)', transition: 'all 1000ms cubic-bezier(0.16, 1, 0.3, 1) 100ms' }}
          >
            <div className="relative" style={{ perspective: '1000px' }}>
              <div className="absolute inset-[-25%] rounded-full blur-3xl"
                style={{
                  background: 'radial-gradient(circle, hsl(0 80% 50% / 0.12) 0%, hsl(45 90% 55% / 0.06) 40%, transparent 70%)',
                  animation: 'loginHeroGlow 4s ease-in-out infinite',
                }} />
              <img
                src={logoPrincipal}
                alt="Bonifica"
                className="relative w-[160px] object-contain"
                style={{
                  filter: 'drop-shadow(0 12px 24px hsl(0 0% 0% / 0.3))',
                  animation: mounted ? 'loginHero3DFloat 6s ease-in-out infinite' : 'none',
                  transformStyle: 'preserve-3d',
                }}
              />
            </div>
          </div>

          <div className="w-full max-w-[440px]">
            {/* Glass card */}
            <div className="login-card relative rounded-2xl border border-foreground/[0.06] bg-[hsl(225_25%_7.5%_/_0.65)] p-7 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.5),0_0_0_1px_hsl(217_91%_60%_/_0.04)] backdrop-blur-xl sm:p-8 lg:p-10">
              {/* Top glow */}
              <div className="pointer-events-none absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="mb-7 text-center">
                <h2 className="text-[clamp(1.25rem,3vw,1.5rem)] font-bold tracking-tight text-foreground">
                  Acesse seu painel
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground/50">
                  Seus pontos e recompensas estão te esperando.
                </p>
              </div>

              {registered && (
                <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]" />
                  <p className="text-[13px] text-foreground">Conta criada. Faça login para continuar.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-[13px] text-foreground">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
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
                    className="h-[48px] rounded-xl border-foreground/[0.06] bg-foreground/[0.03] px-4 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/30 focus-visible:bg-foreground/[0.05] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                  />
                </div>

                <div className="space-y-2">
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
                      className="h-[48px] rounded-xl border-foreground/[0.06] bg-foreground/[0.03] px-4 pr-11 text-[14px] transition-all duration-200 placeholder:text-muted-foreground/25 focus-visible:border-primary/30 focus-visible:bg-foreground/[0.05] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
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

                {/* Forgot password */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[12.5px] font-medium text-primary/70 transition-colors hover:text-primary"
                    onClick={() => {/* future: forgot password flow */}}
                  >
                    Esqueceu sua senha?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex h-[50px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-[hsl(230,80%,58%)] text-[14.5px] font-semibold text-primary-foreground shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_6px_24px_-6px_hsl(var(--primary)_/_0.4)] transition-all duration-200 hover:shadow-[0_1px_0_0_hsl(var(--primary)/_0.6)_inset,0_10px_32px_-4px_hsl(var(--primary)_/_0.5)] hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(225,30%,6%)] active:scale-[0.985] active:brightness-[0.96] disabled:pointer-events-none disabled:opacity-50"
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

            <p className="mt-6 text-center text-[13.5px] text-muted-foreground/40">
              Não tem conta?{' '}
              <Link to="/register" className="font-medium text-primary/80 transition-colors hover:text-primary">
                Criar conta
              </Link>
            </p>
          </div>

          {/* Mobile-only rotating card */}
          <div className="mt-8 md:hidden">
            <RotatingMessageCard mounted={mounted} />
          </div>
        </div>
      </div>
    </div>
  )
}
