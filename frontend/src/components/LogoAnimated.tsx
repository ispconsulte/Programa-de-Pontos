import { useEffect, useState } from 'react'

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

  /* ── Orbit geometry ── */
  const orbitRadius = size * 0.72
  const arcRadius = size * 0.45
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

      {/* ── Unified orbit system (SVG) ── */}
      {!compact && (
        <svg
          className="absolute transition-all duration-1000"
          style={{
            width: size,
            height: size,
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(0.85)',
          }}
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" />
              <stop offset="50%" stopColor="hsl(48 96% 58%)" />
              <stop offset="100%" stopColor="hsl(160 70% 48%)" />
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={orbitRadius}
            fill="none"
            stroke="hsla(217, 91%, 60%, 0.06)"
            strokeWidth={1}
          />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={arcRadius}
            fill="none"
            stroke="hsla(217, 91%, 60%, 0.05)"
            strokeWidth={2.5}
          />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={arcRadius}
            fill="none"
            stroke="url(#progressGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={arcCircumference}
            strokeDashoffset={loaded ? arcCircumference * 0.28 : arcCircumference}
            style={{
              transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
              transformOrigin: 'center',
              transform: 'rotate(-90deg)',
            }}
          />
        </svg>
      )}

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
              boxShadow: '0 0 8px currentColor',
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
          width: compact ? size * 0.52 : size * 0.55,
          height: compact ? size * 0.52 : size * 0.55,
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
            width: compact ? size * 0.38 : size * 0.44,
            height: compact ? size * 0.38 : size * 0.44,
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
