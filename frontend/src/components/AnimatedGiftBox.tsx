import { useEffect, useState, useMemo } from 'react'

/**
 * Animated gift box that opens and releases confetti every few seconds.
 * Pure CSS + React — no external libraries.
 */
export default function AnimatedGiftBox({ size = 96, className = '' }: { size?: number; className?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const loop = () => {
      setOpen(true)
      const closeTimer = setTimeout(() => setOpen(false), 2400)
      return closeTimer
    }

    // First open after 2s
    const initial = setTimeout(() => {
      const ct = loop()
      // Then repeat every 6s
      const interval = setInterval(() => loop(), 6000)
      return () => { clearTimeout(ct); clearInterval(interval) }
    }, 2000)

    return () => clearTimeout(initial)
  }, [])

  // Repeat every 6s
  useEffect(() => {
    if (!open) return
    // no-op, state drives CSS
  }, [open])

  // Stable confetti pieces
  const confetti = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      color: ['hsl(0 80% 55%)', 'hsl(45 90% 55%)', 'hsl(217 91% 60%)', 'hsl(160 60% 50%)', 'hsl(280 70% 60%)', 'hsl(30 85% 55%)'][i % 6],
      angle: (i / 16) * 360,
      distance: 40 + Math.random() * 50,
      size: 4 + Math.random() * 4,
      delay: Math.random() * 0.3,
      rotation: Math.random() * 720 - 360,
      shape: i % 3, // 0=circle, 1=square, 2=rectangle
    })), [])

  const s = size
  const boxW = s * 0.55
  const boxH = s * 0.4
  const lidH = s * 0.18
  const ribbonW = s * 0.08

  return (
    <div className={`relative ${className}`} style={{ width: s, height: s }}>
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none">
        {confetti.map(c => {
          const rad = (c.angle * Math.PI) / 180
          const tx = Math.cos(rad) * c.distance
          const ty = Math.sin(rad) * c.distance - 20
          return (
            <div
              key={c.id}
              className="absolute left-1/2 top-[35%]"
              style={{
                width: c.shape === 2 ? c.size * 1.5 : c.size,
                height: c.size,
                borderRadius: c.shape === 0 ? '50%' : '1px',
                background: c.color,
                opacity: open ? 0 : 0,
                transform: open
                  ? `translate(${tx}px, ${ty}px) rotate(${c.rotation}deg) scale(0.3)`
                  : 'translate(0, 0) rotate(0deg) scale(0)',
                transition: open
                  ? `all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${c.delay}s`
                  : 'all 0.3s ease 0s',
                animation: open ? `confettiBurst 1.2s ease-out ${c.delay}s forwards` : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Gift box */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: boxW, height: boxH + lidH }}>
        {/* Lid */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{
            width: boxW + 6,
            height: lidH,
            top: 0,
            transformOrigin: 'left bottom',
            transform: open ? 'rotate(-35deg) translateY(-8px)' : 'rotate(0deg) translateY(0)',
            transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          }}
        >
          {/* Lid body */}
          <div className="absolute inset-0 rounded-t-lg" style={{ background: 'linear-gradient(180deg, hsl(0 75% 50%) 0%, hsl(0 70% 42%) 100%)' }} />
          {/* Lid ribbon */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: 'hsl(200 60% 65%)' }} />
          {/* Bow */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2">
            <div className="relative" style={{ width: ribbonW * 3, height: ribbonW * 1.5 }}>
              <div className="absolute left-0 top-0 rounded-full" style={{ width: ribbonW * 1.4, height: ribbonW * 1.5, background: 'hsl(200 60% 68%)', transform: 'rotate(-20deg)' }} />
              <div className="absolute right-0 top-0 rounded-full" style={{ width: ribbonW * 1.4, height: ribbonW * 1.5, background: 'hsl(200 60% 62%)', transform: 'rotate(20deg)' }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: ribbonW * 0.6, height: ribbonW * 0.6, background: 'hsl(200 60% 70%)' }} />
            </div>
          </div>
        </div>

        {/* Box body */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-b-lg overflow-hidden" style={{ width: boxW, height: boxH }}>
          {/* Box gradient */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(0 72% 48%) 0%, hsl(0 68% 38%) 100%)' }} />
          {/* Vertical ribbon */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: 'hsl(200 60% 65%)' }} />
          {/* Shadow at top */}
          <div className="absolute top-0 left-0 right-0 h-2" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15), transparent)' }} />
        </div>
      </div>

      {/* Glow pulse when opening */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: s * 0.8,
          height: s * 0.8,
          background: 'radial-gradient(circle, hsl(45 90% 60% / 0.3), transparent 70%)',
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1.3)' : 'scale(0.5)',
          transition: 'all 0.5s ease',
        }}
      />

      <style>{`
        @keyframes confettiBurst {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(0deg) scale(0);
          }
          15% {
            opacity: 1;
            transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), calc(var(--ty) + 60px)) rotate(calc(var(--rot) + 180deg)) scale(0.5);
          }
        }
      `}</style>
    </div>
  )
}
