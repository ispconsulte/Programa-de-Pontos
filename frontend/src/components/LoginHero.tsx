import { useEffect, useState } from 'react'
import { Gift, Trophy, TrendingUp, Crown, Gem, Star } from 'lucide-react'
import LogoAnimated from '@/components/LogoAnimated'
import logoBonifica from '@/assets/logo-bonifica.png'

const tiers = [
  { name: 'Bronze', icon: Star, accent: 'hsl(30 70% 50%)' },
  { name: 'Prata', icon: Gem, accent: 'hsl(220 20% 70%)' },
  { name: 'Ouro', icon: Crown, accent: 'hsl(45 95% 55%)' },
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

        {/* ── Tier indicators ── */}
        <div
          className="flex items-center justify-center gap-4 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(10px)', ...d(450) }}
        >
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            return (
              <div key={tier.name} className="flex items-center gap-3">
                {i > 0 && <div className="h-px w-5 bg-white/[0.06]" />}
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3" style={{ color: tier.accent, opacity: 0.8 }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">{tier.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
