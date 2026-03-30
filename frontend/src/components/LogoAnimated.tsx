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

  const arcRadius = size * 0.45
  const arcCircumference = 2 * Math.PI * arcRadius
  const outerR = size * 0.72
  const midR = size * 0.58

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

      {/* ── SVG ring system ── */}
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
            <linearGradient id="outerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(217 91% 60% / 0.3)" />
              <stop offset="50%" stopColor="hsl(48 96% 58% / 0.15)" />
              <stop offset="100%" stopColor="hsl(160 70% 48% / 0.3)" />
            </linearGradient>
          </defs>

          {/* Outer ring - slow spin */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={outerR}
            fill="none"
            stroke="url(#outerRingGrad)"
            strokeWidth={1.5}
            strokeDasharray={`${outerR * 0.8} ${outerR * 0.4}`}
            style={{
              transformOrigin: 'center',
              animation: loaded ? 'rewardOrbit 40s linear infinite' : 'none',
            }}
          />

          {/* Mid ring - reverse spin, dotted */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={midR}
            fill="none"
            stroke="hsla(217, 91%, 60%, 0.08)"
            strokeWidth={1}
            strokeDasharray="4 12"
            style={{
              transformOrigin: 'center',
              animation: loaded ? 'rewardOrbitCounter 50s linear infinite' : 'none',
            }}
          />

          {/* Inner progress track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={arcRadius}
            fill="none"
            stroke="hsla(217, 91%, 60%, 0.05)"
            strokeWidth={2.5}
          />

          {/* Animated progress arc */}
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

      {/* ── Light rays from center ── */}
      {!compact && [0, 60, 120, 180, 240, 300].map((angle, i) => (
        <div
          key={`ray-${i}`}
          className="absolute"
          style={{
            width: 1,
            height: size * 0.18,
            left: '50%',
            top: '50%',
            transformOrigin: '0 0',
            transform: `rotate(${angle}deg)`,
            background: `linear-gradient(to bottom, hsl(var(--primary) / ${0.12 - i * 0.01}), transparent)`,
            opacity: loaded ? 1 : 0,
            animation: loaded ? `rewardSparkle ${3 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` : 'none',
          }}
        />
      ))}

      {/* ── Sparkle particles ── */}
      {!compact && [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const angle = (i / 7) * 360
        const dist = size * (0.3 + (i % 3) * 0.06)
        const x = 50 + Math.cos((angle * Math.PI) / 180) * (dist / size) * 100
        const y = 50 + Math.sin((angle * Math.PI) / 180) * (dist / size) * 100
        return (
          <div
            key={`particle-${i}`}
            className="absolute rounded-full"
            style={{
              width: 3 + (i % 2) * 2,
              height: 3 + (i % 2) * 2,
              left: `${x}%`,
              top: `${y}%`,
              background: i % 3 === 0
                ? 'hsl(var(--primary))'
                : i % 3 === 1
                  ? 'hsl(48 96% 58%)'
                  : 'hsl(160 70% 48%)',
              opacity: loaded ? 0.5 : 0,
              boxShadow: '0 0 6px currentColor',
              animation: loaded
                ? `rewardSparkle ${2.5 + i * 0.35}s ease-in-out ${i * 0.25}s infinite`
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
