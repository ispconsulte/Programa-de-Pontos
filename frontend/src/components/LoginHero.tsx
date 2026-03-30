import { useEffect, useState } from 'react'
import { Crown, Gem, Star } from 'lucide-react'
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
    <div className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-[linear-gradient(155deg,hsl(225,40%,3%)_0%,hsl(225,30%,5%)_45%,hsl(220,25%,7%)_100%)]" />

      {/* Accent orbs — softer */}
      <div className="absolute -left-[10%] -top-[6%] h-[420px] w-[420px] rounded-full opacity-35"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.12) 0%, transparent 65%)', animation: 'heroGlowDrift 20s ease-in-out infinite' }} />
      <div className="absolute -bottom-[5%] -right-[8%] h-[340px] w-[340px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(45 95% 55% / 0.08) 0%, transparent 60%)', animation: 'heroGlowDrift 24s ease-in-out 5s infinite reverse' }} />

      {/* Grid — barely visible */}
      <div className="absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: 'linear-gradient(hsl(217 91% 60% / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.2) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Edge accents */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      <div className="absolute bottom-0 right-0 top-0 w-px bg-gradient-to-b from-transparent via-white/[0.04] to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center px-8">
        {/* Logo centerpiece — prominent */}
        <div
          className="mb-14 transition-all duration-[1000ms]"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)', ...d(0) }}
        >
          <LogoAnimated src={logoBonifica} size={360} />
        </div>

        {/* Headline */}
        <h2
          className="mb-2.5 text-center text-[22px] font-bold leading-[1.2] tracking-[-0.01em] text-foreground transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(10px)', ...d(250) }}
        >
          Fidelize.{' '}
          <span className="bg-gradient-to-r from-primary via-[hsl(48,96%,62%)] to-[hsl(160,70%,52%)] bg-clip-text text-transparent">
            Recompense. Cresça.
          </span>
        </h2>

        <p
          className="mb-10 max-w-[340px] text-center text-[13px] leading-[1.7] text-muted-foreground/65 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(8px)', ...d(400) }}
        >
          A plataforma completa de fidelização e pontuação para o seu negócio.
        </p>

        {/* ── Tier indicators ── */}
        <div
          className="flex items-center justify-center gap-5 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(8px)', ...d(550) }}
        >
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            return (
              <div key={tier.name} className="flex items-center gap-5">
                {i > 0 && <div className="h-3 w-px bg-white/[0.08]" />}
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3" style={{ color: tier.accent, opacity: 0.7 }} />
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-foreground/40">{tier.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
