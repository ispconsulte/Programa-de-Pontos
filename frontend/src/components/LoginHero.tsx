import { useEffect, useState } from 'react'
import { Gift, Trophy, TrendingUp, Crown, Gem, Star } from 'lucide-react'
import LogoAnimated from '@/components/LogoAnimated'
import logoBonifica from '@/assets/logo-bonifica.png'

const tiers = [
  { name: 'Bronze', pts: '500', icon: Star, accent: 'hsl(30 70% 50%)' },
  { name: 'Prata', pts: '1.500', icon: Gem, accent: 'hsl(220 20% 70%)' },
  { name: 'Ouro', pts: '5.000', icon: Crown, accent: 'hsl(45 95% 55%)' },
]

const features = [
  { icon: TrendingUp, label: 'Pontos automáticos' },
  { icon: Trophy, label: 'Campanhas ativas' },
  { icon: Gift, label: 'Catálogo de brindes' },
]

export default function LoginHero() {
  const [v, setV] = useState(false)
  useEffect(() => { const t = setTimeout(() => setV(true), 80); return () => clearTimeout(t) }, [])

  const d = (ms: number) => ({ transitionDelay: `${ms}ms` })

  return (
    <div className="relative hidden w-[55%] overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-[linear-gradient(155deg,hsl(225,40%,3%)_0%,hsl(225,30%,5%)_45%,hsl(220,25%,7%)_100%)]" />

      {/* Accent orbs */}
      <div className="absolute -left-[10%] -top-[6%] h-[460px] w-[460px] rounded-full opacity-45"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.14) 0%, transparent 65%)', animation: 'heroGlowDrift 18s ease-in-out infinite' }} />
      <div className="absolute -bottom-[5%] -right-[8%] h-[380px] w-[380px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(45 95% 55% / 0.1) 0%, transparent 60%)', animation: 'heroGlowDrift 22s ease-in-out 5s infinite reverse' }} />
      <div className="absolute left-[38%] top-[28%] h-[240px] w-[240px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, hsl(160 70% 48% / 0.1) 0%, transparent 55%)' }} />

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.018]"
        style={{ backgroundImage: 'linear-gradient(hsl(217 91% 60% / 0.25) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.25) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

      {/* Edge accents */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <div className="absolute bottom-0 right-0 top-0 w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10 flex w-full max-w-[480px] flex-col items-center px-10">
        {/* Logo centerpiece */}
        <div
          className="mb-10 transition-all duration-[900ms]"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.93)', ...d(0) }}
        >
          <LogoAnimated src={logoBonifica} size={220} />
        </div>

        {/* Headline */}
        <h2
          className="mb-3 text-center font-heading text-[24px] font-bold leading-[1.18] tracking-tight text-foreground transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(12px)', ...d(200) }}
        >
          Cada pagamento{' '}
          <span className="bg-gradient-to-r from-primary via-[hsl(48,96%,62%)] to-[hsl(160,70%,52%)] bg-clip-text text-transparent">
            vale mais aqui
          </span>
        </h2>
        <p
          className="mb-12 max-w-[360px] text-center text-[13px] leading-[1.65] text-muted-foreground/80 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(10px)', ...d(350) }}
        >
          Acumule pontos, suba de nível e resgate brindes exclusivos. Tudo automático, direto no seu painel.
        </p>

        {/* ── Tier cards ── */}
        <div
          className="mb-10 flex w-full max-w-[360px] items-end justify-center gap-2 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(16px)', ...d(450) }}
        >
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            const h = [82, 102, 124][i]
            return (
              <div
                key={tier.name}
                className="relative flex flex-1 flex-col items-center justify-end rounded-xl border border-white/[0.06] bg-white/[0.015] p-2.5 transition-colors duration-300 hover:border-white/[0.1] hover:bg-white/[0.025]"
                style={{ height: h }}
              >
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl opacity-60" style={{ background: `linear-gradient(90deg, transparent 10%, ${tier.accent}, transparent 90%)` }} />
                <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${tier.accent}12` }}>
                  <Icon className="h-3 w-3" style={{ color: tier.accent }} />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/75">{tier.name}</span>
                <span className="mt-px text-[8px] text-muted-foreground/60">{tier.pts} pts</span>
                {i < tiers.length - 1 && (
                  <div className="absolute -right-[5px] top-1/2 z-20 h-px w-2.5 bg-white/[0.08]" />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Feature chips ── */}
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(8px)', ...d(650) }}
        >
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-full border border-white/[0.05] bg-white/[0.015] px-2.5 py-1 text-[10px] font-medium text-foreground/60">
              <Icon className="h-2.5 w-2.5 text-primary/60" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
