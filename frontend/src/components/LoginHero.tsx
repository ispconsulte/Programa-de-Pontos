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
      {/* ── Background layers ── */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,hsl(225,38%,3%)_0%,hsl(225,30%,5.5%)_50%,hsl(220,26%,7%)_100%)]" />

      {/* Accent blobs */}
      <div className="absolute -left-[12%] -top-[8%] h-[480px] w-[480px] rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.16) 0%, transparent 68%)', animation: 'heroGlowDrift 16s ease-in-out infinite' }} />
      <div className="absolute -bottom-[6%] -right-[10%] h-[400px] w-[400px] rounded-full opacity-35"
        style={{ background: 'radial-gradient(circle, hsl(45 95% 55% / 0.12) 0%, transparent 62%)', animation: 'heroGlowDrift 20s ease-in-out 4s infinite reverse' }} />
      <div className="absolute left-[40%] top-[25%] h-[280px] w-[280px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(160 70% 48% / 0.12) 0%, transparent 60%)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: 'linear-gradient(hsl(217 91% 60% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.3) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />

      {/* Top edge shine */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      {/* Right edge gradient */}
      <div className="absolute bottom-0 right-0 top-0 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

      {/* ── Main content ── */}
      <div className="relative z-10 flex w-full max-w-[520px] flex-col items-center px-10">
        {/* Centerpiece animation */}
        <div
          className="mb-8 transition-all duration-800"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.92)', ...d(0) }}
        >
          <LogoAnimated src={logoBonifica} size={240} />
        </div>

        {/* Headline */}
        <h2
          className="mb-3 text-center font-heading text-[26px] font-bold leading-[1.15] tracking-tight text-foreground transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(14px)', ...d(180) }}
        >
          Cada pagamento{' '}
          <span className="bg-gradient-to-r from-primary via-[hsl(48,96%,62%)] to-[hsl(160,70%,52%)] bg-clip-text text-transparent">
            vale mais aqui
          </span>
        </h2>
        <p
          className="mb-10 max-w-[380px] text-center text-[13px] leading-relaxed text-muted-foreground transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(10px)', ...d(300) }}
        >
          Acumule pontos, suba de nível e resgate brindes exclusivos. Tudo automático, direto no seu painel.
        </p>

        {/* ── Tier progression ── */}
        <div
          className="mb-8 flex w-full max-w-[380px] items-end justify-center gap-2.5 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(18px)', ...d(400) }}
        >
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            const h = [88, 108, 130][i]
            return (
              <div
                key={tier.name}
                className="relative flex flex-1 flex-col items-center justify-end rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 backdrop-blur-sm"
                style={{ height: h }}
              >
                {/* Top accent bar */}
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl" style={{ background: `linear-gradient(90deg, transparent, ${tier.accent}, transparent)` }} />
                <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${tier.accent}15` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: tier.accent }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">{tier.name}</span>
                <span className="mt-0.5 text-[9px] text-muted-foreground">{tier.pts} pts</span>
                {/* Connector */}
                {i < tiers.length - 1 && (
                  <div className="absolute -right-[7px] top-1/2 z-20 h-px w-3 bg-white/10" />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Feature chips ── */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(8px)', ...d(600) }}
        >
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[10.5px] font-medium text-foreground/70">
              <Icon className="h-3 w-3 text-primary/70" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
