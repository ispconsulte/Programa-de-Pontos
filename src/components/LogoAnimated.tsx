import { useEffect, useState } from 'react'

interface LogoAnimatedProps {
  src: string
  alt?: string
  size?: number
}

export default function LogoAnimated({ src, alt = 'Logo', size = 280 }: LogoAnimatedProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-1000"
        style={{
          background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.15), transparent, hsl(var(--primary) / 0.08), transparent)',
          animation: 'spin 8s linear infinite',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* Outer ring */}
      <div
        className="absolute rounded-full border border-primary/20 transition-all duration-700"
        style={{
          inset: 8,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.8)',
        }}
      />

      {/* Inner glow */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          inset: 20,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* Logo */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.2)] transition-all duration-700"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(8px)',
          animation: loaded ? 'float 3s ease-in-out infinite' : 'none',
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
