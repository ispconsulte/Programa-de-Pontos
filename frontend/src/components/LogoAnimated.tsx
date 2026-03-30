import { useEffect, useState } from 'react'
import { Coins, Gift, Sparkles } from 'lucide-react'

interface LogoAnimatedProps {
  src: string
  alt?: string
  size?: number
}

const rewardChips = [
  { label: 'Pontos', icon: Coins, tone: 'hsl(var(--primary) / 0.18)' },
  { label: 'Brindes', icon: Gift, tone: 'hsl(48 95% 58% / 0.18)' },
  { label: 'Beneficios', icon: Sparkles, tone: 'hsl(160 70% 48% / 0.18)' },
]

export default function LogoAnimated({ src, alt = 'Logo', size = 320 }: LogoAnimatedProps) {
  const [loaded, setLoaded] = useState(false)
  const compact = size < 180

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: size * 0.03,
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.16) 0%, hsl(var(--primary) / 0.05) 42%, transparent 74%)',
          transform: loaded ? 'scale(1)' : 'scale(0.84)',
          opacity: loaded ? 1 : 0,
          animation: loaded ? 'bonusHalo 5.2s ease-in-out infinite' : 'none',
        }}
      />

      <div
        className="absolute rounded-[36px] border border-white/10 transition-all duration-1000"
        style={{
          inset: compact ? size * 0.18 : size * 0.15,
          background: 'linear-gradient(180deg, hsl(var(--surface-1)), hsl(var(--surface-2)))',
          boxShadow: '0 24px 64px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
          transform: loaded ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.92)',
          opacity: loaded ? 1 : 0,
        }}
      >
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div
          className="absolute left-[14%] top-[16%] h-[32%] w-[72%] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(48 96% 58% / 0.18) 0%, transparent 72%)',
            filter: 'blur(22px)',
          }}
        />
        {!compact && (
          <>
            <div className="absolute -left-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-white/10 bg-[hsl(var(--surface-2))]" />
            <div className="absolute -right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-white/10 bg-[hsl(var(--surface-2))]" />
          </>
        )}
      </div>

      <div
        className="absolute rounded-[30px] border border-primary/10 transition-all duration-1000"
        style={{
          inset: compact ? size * 0.21 : size * 0.19,
          opacity: loaded ? 1 : 0.2,
        }}
      />

      {!compact && rewardChips.map((chip, index) => {
        const positions = [
          { top: '16%', left: '-1%' },
          { top: '16%', right: '-2%' },
          { bottom: '15%', left: '10%' },
        ][index]

        return (
          <div
            key={chip.label}
            className="absolute z-20 flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[12px] font-semibold text-foreground backdrop-blur-sm transition-all duration-1000"
            style={{
              ...positions,
              background: `linear-gradient(180deg, ${chip.tone}, hsl(var(--surface-1)))`,
              boxShadow: '0 14px 32px rgba(0,0,0,0.18)',
              transform: loaded ? 'translateY(0)' : 'translateY(14px)',
              opacity: loaded ? 1 : 0,
              animation: loaded ? `float ${3.6 + index * 0.45}s ease-in-out ${index * 0.4}s infinite` : 'none',
            }}
          >
            <chip.icon className="h-3.5 w-3.5 text-primary" />
            <span>{chip.label}</span>
          </div>
        )
      })}

      {compact && (
        <>
          <div
            className="absolute z-20 flex items-center justify-center rounded-full border border-white/10 bg-[hsl(var(--surface-1))] text-primary"
            style={{
              width: size * 0.16,
              height: size * 0.16,
              top: size * 0.16,
              left: size * 0.12,
              opacity: loaded ? 1 : 0,
              animation: loaded ? 'float 3.8s ease-in-out infinite' : 'none',
            }}
          >
            <Coins className="h-3.5 w-3.5" />
          </div>
          <div
            className="absolute z-20 flex items-center justify-center rounded-full border border-white/10 bg-[hsl(var(--surface-1))] text-primary"
            style={{
              width: size * 0.16,
              height: size * 0.16,
              right: size * 0.1,
              bottom: size * 0.16,
              opacity: loaded ? 1 : 0,
              animation: loaded ? 'float 4.2s ease-in-out 0.4s infinite' : 'none',
            }}
          >
            <Gift className="h-3.5 w-3.5" />
          </div>
        </>
      )}

      {[0, 1, 2].map((i) => (
        <div
          key={`spark-${i}`}
          className="absolute rounded-full bg-primary/70"
          style={{
            width: compact ? 5 : 8,
            height: compact ? 5 : 8,
            top: `${20 + i * 22}%`,
            left: `${i === 1 ? 78 : 17 + i * 6}%`,
            animation: loaded ? `sparkle ${2.2 + i * 0.3}s ease-in-out ${i * 0.35}s infinite` : 'none',
            opacity: loaded ? 1 : 0,
            boxShadow: '0 0 16px hsl(var(--primary) / 0.55)',
          }}
        />
      ))}

      <div
        className="absolute rounded-full"
        style={{
          inset: compact ? size * 0.25 : size * 0.23,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 72%)',
          animation: loaded ? 'pulseGlow 3.8s ease-in-out infinite' : 'none',
          opacity: loaded ? 1 : 0,
        }}
      />

      <img
        src={src}
        alt={alt}
        className="relative z-30 object-contain transition-all duration-700"
        style={{
          width: compact ? size * 0.42 : size * 0.4,
          height: compact ? size * 0.42 : size * 0.4,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.84) translateY(16px)',
          animation: loaded ? 'logoFloat 4.4s ease-in-out infinite' : 'none',
          filter: loaded
            ? 'drop-shadow(0 0 24px hsl(48 96% 58% / 0.22)) drop-shadow(0 10px 18px rgba(0,0,0,0.28))'
            : 'none',
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
