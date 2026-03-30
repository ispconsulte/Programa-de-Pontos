import { useEffect, useState } from 'react'

interface LogoAnimatedProps {
  src: string
  alt?: string
  size?: number
}

export default function LogoAnimated({ src, alt = 'Logo', size = 320 }: LogoAnimatedProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  const r = size / 2

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, perspective: size * 2.5 }}
    >
      {/* ── 3D tilted outer ring ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: 0,
          border: '1.5px solid hsl(var(--primary) / 0.15)',
          transform: loaded ? 'rotateX(65deg) rotateZ(0deg)' : 'rotateX(65deg) scale(0.8)',
          opacity: loaded ? 1 : 0,
          animation: loaded ? 'ring3dSpin 12s linear infinite' : 'none',
          boxShadow: '0 0 30px hsl(var(--primary) / 0.06), inset 0 0 20px hsl(var(--primary) / 0.03)',
        }}
      />

      {/* ── Second 3D ring — counter-tilt ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: 20,
          border: '1px solid hsl(var(--primary) / 0.1)',
          transform: loaded ? 'rotateX(65deg) rotateY(30deg)' : 'rotateX(65deg) rotateY(30deg) scale(0.8)',
          opacity: loaded ? 0.7 : 0,
          animation: loaded ? 'ring3dSpinReverse 16s linear infinite' : 'none',
        }}
      />

      {/* ── Third ring — different axis ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: 40,
          border: '1px dashed hsl(var(--primary) / 0.08)',
          transform: loaded ? 'rotateY(65deg)' : 'rotateY(65deg) scale(0.8)',
          opacity: loaded ? 0.5 : 0,
          animation: loaded ? 'ring3dSpinY 20s linear infinite' : 'none',
        }}
      />

      {/* ── Orbiting 3D particles ── */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const orbitRadius = r * 0.55 + (i % 3) * 18
        const particleSize = 3 + (i % 3) * 1.5
        const speed = 8 + i * 1.8
        const tilt = 55 + (i % 3) * 15
        return (
          <div
            key={`p3d-${i}`}
            className="absolute"
            style={{
              width: orbitRadius * 2,
              height: orbitRadius * 2,
              top: `calc(50% - ${orbitRadius}px)`,
              left: `calc(50% - ${orbitRadius}px)`,
              transform: `rotateX(${tilt}deg) rotateZ(${i * 45}deg)`,
              animation: loaded ? `ring3dSpin ${speed}s linear ${i * -1.5}s infinite` : 'none',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
              pointerEvents: 'none' as const,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: particleSize,
                height: particleSize,
                top: 0,
                left: '50%',
                marginLeft: -particleSize / 2,
                background: 'hsl(var(--primary))',
                boxShadow: `0 0 ${6 + i * 2}px hsl(var(--primary) / 0.5)`,
                opacity: 0.6 + (i % 3) * 0.15,
              }}
            />
          </div>
        )
      })}

      {/* ── Pulsing glow sphere ── */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: size * 0.2,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary) / 0.03) 50%, transparent 75%)',
          animation: loaded ? 'pulseGlow 3.5s ease-in-out infinite' : 'none',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* ── Logo image (floating center) ── */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 object-contain transition-all duration-700"
        style={{
          width: size * 0.45,
          height: size * 0.45,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(16px)',
          animation: loaded ? 'logoFloat 4s ease-in-out infinite' : 'none',
          filter: loaded
            ? 'drop-shadow(0 0 28px hsl(var(--primary) / 0.3)) drop-shadow(0 6px 16px rgba(0,0,0,0.35))'
            : 'none',
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
