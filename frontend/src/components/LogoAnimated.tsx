import { useEffect, useState } from 'react'
import { Coins, Gift, Sparkles } from 'lucide-react'

interface LogoAnimatedProps {
  src: string
  alt?: string
  size?: number
}

export default function LogoAnimated({ src, alt = 'Logo', size = 320 }: LogoAnimatedProps) {
  const [loaded, setLoaded] = useState(false)
  const compact = size < 180

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 120)
    return () => clearTimeout(t)
  }, [])

  /* ── Orbiting reward tokens ── */
  const orbitTokens = compact
    ? []
    : [
        { icon: Coins, angle: 0, radius: 0.48, color: 'hsl(var(--primary))', dur: 26, label: '' },
        { icon: Gift, angle: 120, radius: 0.48, color: 'hsl(48 96% 58%)', dur: 26, label: '' },
        { icon: Sparkles, angle: 240, radius: 0.48, color: 'hsl(160 70% 48%)', dur: 26, label: '' },
      ]

  /* ── Progress arc segments ── */
  const arcRadius = size * 0.35
  const arcCircumference = 2 * Math.PI * arcRadius

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* ── Ambient glow ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: size * 0.05,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary) / 0.03) 50%, transparent 75%)',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.7)',
          animation: loaded ? 'rewardCorePulse 4s ease-in-out infinite' : 'none',
        }}
      />

      {/* ── Concentric orbit rings ── */}
      {!compact && [0.48, 0.38].map((r, i) => (
        <div
          key={`ring-${i}`}
          className="absolute rounded-full border transition-all duration-1000"
          style={{
            width: size * r * 2,
            height: size * r * 2,
            borderColor: i === 0 ? 'hsla(217, 91%, 60%, 0.08)' : 'hsla(217, 91%, 60%, 0.04)',
            borderStyle: i === 0 ? 'solid' : 'dashed',
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(0.8)',
            transitionDelay: `${i * 150}ms`,
          }}
        />
      ))}

      {/* ── SVG progress arcs ── */}
      {!compact && (
        <svg
          className="absolute transition-all duration-1000"
          style={{
            width: size * 0.84,
            height: size * 0.84,
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(0.8)',
          }}
          viewBox={`0 0 ${size * 0.84} ${size * 0.84}`}
        >
          {/* Background arc */}
          <circle
            cx={size * 0.42}
            cy={size * 0.42}
            r={arcRadius}
            fill="none"
            stroke="hsla(217, 91%, 60%, 0.06)"
            strokeWidth={compact ? 2 : 3}
          />
          {/* Animated progress arc */}
          <circle
            cx={size * 0.42}
            cy={size * 0.42}
            r={arcRadius}
            fill="none"
            stroke="url(#progressGrad)"
            strokeWidth={compact ? 2 : 3}
            strokeLinecap="round"
            strokeDasharray={arcCircumference}
            strokeDashoffset={loaded ? arcCircumference * 0.28 : arcCircumference}
            style={{
              transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
              transformOrigin: 'center',
              transform: 'rotate(-90deg)',
            }}
          />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" />
              <stop offset="50%" stopColor="hsl(48 96% 58%)" />
              <stop offset="100%" stopColor="hsl(160 70% 48%)" />
            </linearGradient>
          </defs>
        </svg>
      )}

      {/* ── Orbiting reward tokens ── */}
      {orbitTokens.map((token, i) => {
        const Icon = token.icon
        const tokenSize = size * 0.12
        return (
          <div
            key={`orbit-${i}`}
            className="absolute z-20 transition-all duration-1000"
            style={{
              width: size * token.radius * 2,
              height: size * token.radius * 2,
              opacity: loaded ? 1 : 0,
              animation: loaded
                ? `rewardOrbit ${token.dur}s linear ${i * 0.3}s infinite`
                : 'none',
              transform: loaded ? `rotate(${token.angle}deg)` : `rotate(${token.angle}deg) scale(0.5)`,
            }}
          >
            {/* Token sits at top of the orbit circle */}
            <div
              className="absolute left-1/2 top-0 flex items-center justify-center rounded-xl border border-white/15 backdrop-blur-sm"
              style={{
                width: tokenSize,
                height: tokenSize,
                marginLeft: -tokenSize / 2,
                marginTop: -tokenSize / 2,
                background: `linear-gradient(135deg, ${token.color.replace(')', ' / 0.2)')}, hsl(var(--surface-1)))`,
                boxShadow: `0 0 20px ${token.color.replace(')', ' / 0.15)')}, 0 8px 24px rgba(0,0,0,0.2)`,
                animation: loaded ? `rewardOrbitCounter ${token.dur}s linear ${i * 0.3}s infinite` : 'none',
              }}
            >
              <Icon
                className="text-foreground/90"
                style={{ width: tokenSize * 0.45, height: tokenSize * 0.45 }}
              />
            </div>
          </div>
        )
      })}

      {/* ── Sparkle particles ── */}
      {!compact && [0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * 360
        const dist = size * (0.28 + (i % 2) * 0.08)
        const x = 50 + Math.cos((angle * Math.PI) / 180) * (dist / size) * 100
        const y = 50 + Math.sin((angle * Math.PI) / 180) * (dist / size) * 100
        return (
          <div
            key={`particle-${i}`}
            className="absolute rounded-full"
            style={{
              width: 4 + (i % 2) * 2,
              height: 4 + (i % 2) * 2,
              left: `${x}%`,
              top: `${y}%`,
              background: i % 3 === 0
                ? 'hsl(var(--primary))'
                : i % 3 === 1
                  ? 'hsl(48 96% 58%)'
                  : 'hsl(160 70% 48%)',
              opacity: loaded ? 0.6 : 0,
              boxShadow: `0 0 8px currentColor`,
              animation: loaded
                ? `rewardSparkle ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`
                : 'none',
            }}
          />
        )
      })}

      {/* ── Inner glow ring ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: compact ? size * 0.28 : size * 0.24,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)',
          opacity: loaded ? 1 : 0,
          animation: loaded ? 'rewardCorePulse 3.5s ease-in-out 0.5s infinite' : 'none',
        }}
      />

      {/* ── Central logo ── */}
      <div
        className="relative z-30 flex items-center justify-center transition-all duration-700"
        style={{
          width: compact ? size * 0.52 : size * 0.44,
          height: compact ? size * 0.52 : size * 0.44,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(12px)',
          animation: loaded ? 'rewardCoreFloat 5s ease-in-out infinite' : 'none',
        }}
      >
        <img
          src={src}
          alt={alt}
          className="object-contain"
          style={{
            width: compact ? size * 0.38 : size * 0.32,
            height: compact ? size * 0.38 : size * 0.32,
            filter: loaded
              ? 'drop-shadow(0 0 20px hsl(var(--primary) / 0.25)) drop-shadow(0 0 40px hsl(48 96% 58% / 0.12))'
              : 'none',
          }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
