import { useEffect, useState } from 'react'
import { Star, Gift, Trophy, TrendingUp, Crown, Gem } from 'lucide-react'
import LogoAnimated from '@/components/LogoAnimated'
import logoBonifica from '@/assets/logo-bonifica.png'

/* ── Tier cards for the progression ladder ── */
const tiers = [
  { name: 'Bronze', pts: '500 pts', color: 'from-amber-700/80 to-amber-900/60', border: 'border-amber-600/30', icon: Star, delay: 0 },
  { name: 'Prata', pts: '1.500 pts', color: 'from-slate-400/80 to-slate-600/60', border: 'border-slate-400/30', icon: Gem, delay: 0.15 },
  { name: 'Ouro', pts: '5.000 pts', color: 'from-yellow-500/80 to-amber-600/60', border: 'border-yellow-400/30', icon: Crown, delay: 0.3 },
]

/* ── Floating metric pills ── */
const metrics = [
  { label: '+2.340 pts', sub: 'este mês', x: '8%', y: '22%', delay: 0.4 },
  { label: '97%', sub: 'retenção', x: '72%', y: '18%', delay: 0.6 },
  { label: '12 resgates', sub: 'últimos 7 dias', x: '68%', y: '76%', delay: 0.8 },
]

export default function LoginHero() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
      {/* ── Deep layered background ── */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,hsl(225,38%,3%)_0%,hsl(225,30%,6%)_40%,hsl(220,28%,8%)_100%)]" />

      {/* Accent glow top-left */}
      <div
        className="absolute -left-[15%] -top-[10%] h-[500px] w-[500px] rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, hsl(217 91% 60% / 0.18) 0%, transparent 70%)',
          animation: 'heroGlowDrift 14s ease-in-out infinite',
        }}
      />
      {/* Warm accent glow bottom-right */}
      <div
        className="absolute -bottom-[8%] -right-[12%] h-[440px] w-[440px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, hsl(38 92% 50% / 0.14) 0%, transparent 65%)',
          animation: 'heroGlowDrift 18s ease-in-out 3s infinite reverse',
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(217 91% 60% / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.35) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Horizontal shine line */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10 flex w-full max-w-[540px] flex-col items-center px-8">
        {/* Logo */}
        <div
          className="mb-6 transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
          }}
        >
          <LogoAnimated src={logoBonifica} size={260} />
        </div>

        {/* Tagline */}
        <h2
          className="mb-2 text-center text-[28px] font-bold leading-[1.15] tracking-tight text-foreground transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transitionDelay: '200ms',
          }}
        >
          Fidelidade que{' '}
          <span className="bg-gradient-to-r from-primary via-[hsl(48,96%,62%)] to-[hsl(160,70%,52%)] bg-clip-text text-transparent">
            gera resultado
          </span>
        </h2>

        <p
          className="mb-8 max-w-[400px] text-center text-[13.5px] leading-relaxed text-muted-foreground transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            transitionDelay: '350ms',
          }}
        >
          Pontos, recompensas e campanhas que transformam pagamentos em fidelização real.
        </p>

        {/* ── Tier progression cards ── */}
        <div className="mb-8 flex w-full max-w-[420px] items-end justify-center gap-3">
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            const heights = ['h-[100px]', 'h-[120px]', 'h-[140px]']
            return (
              <div
                key={tier.name}
                className={`relative flex flex-1 flex-col items-center justify-end rounded-xl border bg-gradient-to-b p-3 backdrop-blur-sm transition-all duration-700 ${tier.color} ${tier.border} ${heights[i]}`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.92)',
                  transitionDelay: `${400 + tier.delay * 1000}ms`,
                }}
              >
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white/90" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                  {tier.name}
                </span>
                <span className="mt-0.5 text-[10px] text-white/50">{tier.pts}</span>

                {/* Progress connector line */}
                {i < tiers.length - 1 && (
                  <div className="absolute -right-2 top-1/2 z-20 h-px w-4 bg-gradient-to-r from-white/20 to-white/5" />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Feature chips ── */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transitionDelay: '800ms',
          }}
        >
          {[
            { icon: TrendingUp, label: 'Pontos automáticos' },
            { icon: Trophy, label: 'Campanhas ativas' },
            { icon: Gift, label: 'Catálogo de brindes' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-foreground/80 backdrop-blur-sm"
            >
              <Icon className="h-3 w-3 text-primary/80" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Floating metric pills ── */}
      {metrics.map((m) => (
        <div
          key={m.label}
          className="absolute z-10 rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2 backdrop-blur-md transition-all duration-1000"
          style={{
            left: m.x,
            top: m.y,
            opacity: visible ? 0.7 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            transitionDelay: `${m.delay * 1000}ms`,
            animation: visible ? `heroFloat ${5 + m.delay * 2}s ease-in-out ${m.delay}s infinite` : 'none',
          }}
        >
          <div className="text-[13px] font-bold text-foreground/90">{m.label}</div>
          <div className="text-[10px] text-muted-foreground">{m.sub}</div>
        </div>
      ))}
    </div>
  )
}
