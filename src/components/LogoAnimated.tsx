import { useEffect, useState } from 'react'

interface LogoAnimatedProps {
  src: string
  alt?: string
  size?: number
}

export default function LogoAnimated({ src, alt = 'Logo', size = 320 }: LogoAnimatedProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 150)
    return () => clearTimeout(t)
  }, [])

  const r = size / 2

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* ── Orbiting particles ── */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={`particle-${i}`}
          className="absolute rounded-full bg-primary"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            top: '50%',
            left: '50%',
            opacity: loaded ? 0.5 + (i % 3) * 0.15 : 0,
            filter: `blur(${i % 2}px)`,
            animation: loaded
              ? `orbitParticle ${6 + i * 1.5}s linear ${i * -1.2}s infinite`
              : 'none',
            transformOrigin: '0 0',
            // Each particle orbits at a different radius
            ['--orbit-r' as string]: `${r * 0.7 + i * 8}px`,
            transition: 'opacity 0.8s ease',
          }}
        />
      ))}

      {/* ── Outer spinning ring (conic gradient) ── */}
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-1000"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0%, hsl(var(--primary) / 0.2) 15%, transparent 30%, hsl(var(--primary) / 0.12) 50%, transparent 65%, hsl(var(--primary) / 0.18) 80%, transparent 100%)',
          animation: loaded ? 'spin 10s linear infinite' : 'none',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* ── Second counter-rotating ring ── */}
      <div
        className="absolute rounded-full transition-opacity duration-1000"
        style={{
          inset: 16,
          border: '1px dashed hsl(var(--primary) / 0.12)',
          animation: loaded ? 'spin 15s linear infinite reverse' : 'none',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* ── Pulsing glow core ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: 40,
          background:
            'radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, hsl(var(--primary) / 0.04) 50%, transparent 75%)',
          animation: loaded ? 'pulseGlow 3s ease-in-out infinite' : 'none',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* ── Outer solid ring with glow ── */}
      <div
        className="absolute rounded-full transition-all duration-700"
        style={{
          inset: 6,
          border: '1.5px solid hsl(var(--primary) / 0.18)',
          boxShadow: loaded
            ? '0 0 20px hsl(var(--primary) / 0.08), inset 0 0 20px hsl(var(--primary) / 0.04)'
            : 'none',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.85)',
        }}
      />

      {/* ── Bonus sparkle dots (static positioned, blinking) ── */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * 90 + 45) * (Math.PI / 180)
        const dist = r * 0.82
        return (
          <div
            key={`sparkle-${i}`}
            className="absolute rounded-full bg-primary"
            style={{
              width: 3,
              height: 3,
              top: `calc(50% + ${Math.sin(angle) * dist}px)`,
              left: `calc(50% + ${Math.cos(angle) * dist}px)`,
              transform: 'translate(-50%, -50%)',
              opacity: loaded ? 1 : 0,
              animation: loaded ? `sparkle 2s ease-in-out ${i * 0.5}s infinite` : 'none',
              boxShadow: '0 0 6px hsl(var(--primary) / 0.6)',
              transition: 'opacity 0.6s ease',
            }}
          />
        )
      })}

      {/* ── Logo image ── */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 object-contain transition-all duration-700"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(12px)',
          animation: loaded ? 'logoFloat 4s ease-in-out infinite' : 'none',
          filter: loaded
            ? 'drop-shadow(0 0 24px hsl(var(--primary) / 0.25)) drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
            : 'none',
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
