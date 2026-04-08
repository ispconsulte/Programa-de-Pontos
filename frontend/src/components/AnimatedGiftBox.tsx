import { useEffect, useState, useMemo } from 'react'

/** Animated gift box with confetti burst, sparkle trails, and floating reward icons */
export default function AnimatedGiftBox({ size = 96, className = '' }: { size?: number; className?: string }) {
  const [open, setOpen] = useState(false)
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>
    let interval: ReturnType<typeof setInterval>

    const trigger = () => {
      setOpen(true)
      setCycle(c => c + 1)
      closeTimer = setTimeout(() => setOpen(false), 2800)
    }

    const initial = setTimeout(() => {
      trigger()
      interval = setInterval(trigger, 6000)
    }, 2500)

    return () => { clearTimeout(initial); clearTimeout(closeTimer); clearInterval(interval) }
  }, [])

  // Main confetti burst — 28 pieces for a fuller explosion
  const confetti = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * 360 + (Math.random() * 12 - 6)
      const rad = (angle * Math.PI) / 180
      const dist = 30 + Math.random() * 55
      return {
        id: i,
        color: ['#ef4444', '#eab308', '#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899', '#06b6d4'][i % 8],
        tx: Math.cos(rad) * dist,
        ty: Math.sin(rad) * dist + 10,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 250,
        rot: Math.random() * 720 - 360,
        shape: i % 4, // 0=circle, 1=square, 2=rect, 3=star-like
      }
    }), [])

  // Sparkle trails — small bright dots that drift downward
  const sparkles = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 60,
      ty: 40 + Math.random() * 50,
      delay: 100 + Math.random() * 400,
      size: 2 + Math.random() * 2.5,
      color: ['#fbbf24', '#f9fafb', '#fde68a', '#a5f3fc', '#c4b5fd'][i % 5],
    })), [])

  // Floating reward symbols that pop out
  const rewards = useMemo(() => [
    { id: 0, emoji: '⭐', angle: -50, dist: 55, delay: 150 },
    { id: 1, emoji: '🎯', angle: 30, dist: 50, delay: 300 },
    { id: 2, emoji: '💎', angle: -130, dist: 48, delay: 200 },
  ], [])

  const s = size
  const boxW = s * 0.52
  const boxH = s * 0.38
  const lidH = s * 0.16
  const ribbonW = s * 0.07

  return (
    <div className={`relative ${className}`} style={{ width: s, height: s }}>
      {/* Confetti particles */}
      {confetti.map(c => {
        const w = c.shape === 2 ? c.size * 2 : c.shape === 3 ? c.size * 1.2 : c.size
        const h = c.size
        const br = c.shape === 0 ? '50%' : c.shape === 3 ? '2px' : '1.5px'
        return (
          <div
            key={`c-${c.id}-${cycle}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '36%',
              width: w,
              height: h,
              borderRadius: br,
              background: c.color,
              opacity: 0,
              transform: 'translate(-50%, -50%) scale(0)',
              ...(open ? {
                animation: `confettiBurst 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${c.delay}ms forwards`,
                '--conf-tx': `${c.tx}px`,
                '--conf-ty': `${c.ty}px`,
                '--conf-ty2': `${c.ty + 50}px`,
                '--conf-rot': `${c.rot}deg`,
                '--conf-rot2': `${c.rot + 180}deg`,
              } as React.CSSProperties : {}),
            }}
          />
        )
      })}

      {/* Sparkle trails */}
      {sparkles.map(sp => (
        <div
          key={`sp-${sp.id}-${cycle}`}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: '50%',
            top: '36%',
            width: sp.size,
            height: sp.size,
            background: sp.color,
            boxShadow: `0 0 ${sp.size * 2}px ${sp.color}`,
            opacity: 0,
            transform: 'translate(-50%, -50%) scale(0)',
            ...(open ? {
              animation: `sparkleFly 1.6s ease-out ${sp.delay}ms forwards`,
              '--sp-x': `${sp.x}px`,
              '--sp-ty': `${sp.ty}px`,
            } as React.CSSProperties : {}),
          }}
        />
      ))}

      {/* Floating reward symbols */}
      {rewards.map(r => {
        const rad = (r.angle * Math.PI) / 180
        const rx = Math.cos(rad) * r.dist
        const ry = Math.sin(rad) * r.dist - 10
        return (
          <div
            key={`r-${r.id}-${cycle}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '36%',
              fontSize: s * 0.12,
              lineHeight: 1,
              opacity: 0,
              transform: 'translate(-50%, -50%) scale(0)',
              ...(open ? {
                animation: `rewardPop 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${r.delay}ms forwards`,
                '--rw-tx': `${rx}px`,
                '--rw-ty': `${ry}px`,
              } as React.CSSProperties : {}),
            }}
          >
            {r.emoji}
          </div>
        )
      })}

      {/* Gift box */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%]" style={{ width: boxW + 6, height: boxH + lidH + 6 }}>
        {/* Lid */}
        <div
          style={{
            position: 'absolute',
            width: boxW + 6,
            height: lidH,
            left: 0,
            top: 0,
            transformOrigin: 'left bottom',
            transform: open ? 'rotate(-45deg) translateY(-8px)' : 'rotate(0deg)',
            transition: 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            zIndex: 10,
          }}
        >
          <div className="absolute inset-0 rounded-t-md" style={{ background: 'linear-gradient(180deg, #dc3545 0%, #b52a37 100%)' }} />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: '#7bb8d4' }} />
          {/* Bow */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -ribbonW * 1.2 }}>
            <div className="relative" style={{ width: ribbonW * 3.5, height: ribbonW * 2 }}>
              <div className="absolute rounded-full" style={{ left: 0, top: 0, width: ribbonW * 1.6, height: ribbonW * 1.8, background: '#8ec5db', transform: 'rotate(-25deg)' }} />
              <div className="absolute rounded-full" style={{ right: 0, top: 0, width: ribbonW * 1.6, height: ribbonW * 1.8, background: '#72b3cd', transform: 'rotate(25deg)' }} />
              <div className="absolute rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: ribbonW * 0.7, height: ribbonW * 0.7, background: '#9dd0e5' }} />
            </div>
          </div>
        </div>

        {/* Box body */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-b-md overflow-hidden" style={{ width: boxW, height: boxH }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #d43242 0%, #a82533 100%)' }} />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: '#7bb8d4' }} />
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent)' }} />
        </div>
      </div>

      {/* Glow burst */}
      <div
        className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: s * 0.85,
          height: s * 0.85,
          background: 'radial-gradient(circle, hsl(45 90% 60% / 0.3), hsl(30 90% 50% / 0.1) 50%, transparent 70%)',
          opacity: open ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${open ? 1.5 : 0.4})`,
          transition: 'all 0.6s ease',
        }}
      />

      <style>{`
        @keyframes confettiBurst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.2);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--conf-tx), var(--conf-ty)) rotate(var(--conf-rot)) scale(1.1);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--conf-tx), var(--conf-ty2)) rotate(var(--conf-rot2)) scale(0.3);
          }
        }

        @keyframes sparkleFly {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(0, 0) scale(0);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--sp-x), 0) scale(1.2);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--sp-x), var(--sp-ty)) scale(0);
          }
        }

        @keyframes rewardPop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(0, 0) scale(0) rotate(-20deg);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--rw-tx), var(--rw-ty)) scale(1.2) rotate(5deg);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--rw-tx), var(--rw-ty)) scale(1) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--rw-tx), calc(var(--rw-ty) - 15px)) scale(0.6) rotate(10deg);
          }
        }
      `}</style>
    </div>
  )
}
