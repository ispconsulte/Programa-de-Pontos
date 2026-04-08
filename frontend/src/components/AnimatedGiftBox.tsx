import { useEffect, useState, useMemo } from 'react'

/** Animated gift box: idle → shake → burst open with confetti */
export default function AnimatedGiftBox({ size = 96, className = '' }: { size?: number; className?: string }) {
  const [phase, setPhase] = useState<'idle' | 'shake' | 'open'>('idle')
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []

    const trigger = () => {
      setPhase('idle')
      const t1 = setTimeout(() => setPhase('shake'), 300)
      const t2 = setTimeout(() => {
        setPhase('open')
        setCycle(c => c + 1)
      }, 1400)
      const t3 = setTimeout(() => setPhase('idle'), 2600)
      timers.push(t1, t2, t3)
    }

    const initial = setTimeout(() => {
      trigger()
    }, 1800)
    timers.push(initial)

    const interval = setInterval(trigger, 7000)

    return () => { timers.forEach(clearTimeout); clearInterval(interval) }
  }, [])

  const isOpen = phase === 'open'
  const isShaking = phase === 'shake'

  const confetti = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * 360 + (Math.random() * 10 - 5)
      const rad = (angle * Math.PI) / 180
      const dist = 28 + Math.random() * 50
      return {
        id: i,
        color: ['#ef4444', '#eab308', '#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899', '#06b6d4'][i % 8],
        tx: Math.cos(rad) * dist,
        ty: Math.sin(rad) * dist + 15,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 200,
        rot: Math.random() * 720 - 360,
        shape: i % 4,
      }
    }), [])

  const sparkles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 55,
      ty: 35 + Math.random() * 45,
      delay: 80 + Math.random() * 350,
      size: 2 + Math.random() * 2.5,
      color: ['#fbbf24', '#f9fafb', '#fde68a', '#a5f3fc', '#c4b5fd'][i % 5],
    })), [])

  const rewards = useMemo(() => [
    { id: 0, emoji: '⭐', angle: 40, dist: 50, delay: 120 },
    { id: 1, emoji: '🎯', angle: 140, dist: 45, delay: 260 },
    { id: 2, emoji: '💎', angle: 85, dist: 42, delay: 180 },
  ], [])

  const s = size
  const boxW = s * 0.52
  const boxH = s * 0.38
  const lidH = s * 0.16
  const ribbonW = s * 0.07

  const compact = s < 48

  return (
    <div className={`relative ${className}`} style={{ width: s, height: s, overflow: compact ? 'hidden' : 'visible' }}>
      {/* Confetti */}
      {confetti.map(c => {
        const w = c.shape === 2 ? c.size * 2 : c.shape === 3 ? c.size * 1.2 : c.size
        const h = c.size
        const br = c.shape === 0 ? '50%' : c.shape === 3 ? '2px' : '1.5px'
        return (
          <div
            key={`c-${c.id}-${cycle}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%', top: '38%',
              width: w, height: h, borderRadius: br,
              background: c.color, opacity: 0,
              transform: 'translate(-50%, -50%) scale(0)',
              ...(isOpen ? {
                animation: `giftConfetti 1.5s cubic-bezier(0.25,0.46,0.45,0.94) ${c.delay}ms forwards`,
                '--c-tx': `${c.tx}px`, '--c-ty': `${c.ty}px`,
                '--c-ty2': `${c.ty + 55}px`, '--c-rot': `${c.rot}deg`,
                '--c-rot2': `${c.rot + 180}deg`,
              } as React.CSSProperties : {}),
            }}
          />
        )
      })}

      {/* Sparkles */}
      {sparkles.map(sp => (
        <div
          key={`sp-${sp.id}-${cycle}`}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: '50%', top: '38%',
            width: sp.size, height: sp.size,
            background: sp.color,
            boxShadow: `0 0 ${sp.size * 2}px ${sp.color}`,
            opacity: 0, transform: 'translate(-50%,-50%) scale(0)',
            ...(isOpen ? {
              animation: `giftSparkle 1.6s ease-out ${sp.delay}ms forwards`,
              '--sp-x': `${sp.x}px`, '--sp-ty': `${sp.ty}px`,
            } as React.CSSProperties : {}),
          }}
        />
      ))}

      {/* Reward emojis */}
      {rewards.map(r => {
        const rad = (r.angle * Math.PI) / 180
        return (
          <div
            key={`r-${r.id}-${cycle}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%', top: '38%',
              fontSize: s * 0.13, lineHeight: 1,
              opacity: 0, transform: 'translate(-50%,-50%) scale(0)',
              ...(isOpen ? {
                animation: `giftReward 1.8s cubic-bezier(0.34,1.56,0.64,1) ${r.delay}ms forwards`,
                '--rw-tx': `${Math.cos(rad) * r.dist}px`,
                '--rw-ty': `${Math.sin(rad) * r.dist - 8}px`,
              } as React.CSSProperties : {}),
            }}
          >
            {r.emoji}
          </div>
        )
      })}

      {/* Gift box group */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%]"
        style={{
          width: boxW + 6, height: boxH + lidH,
          animation: isShaking ? 'giftShake 0.12s ease-in-out infinite' : 'none',
        }}
      >
        {/* Lid */}
        <div
          style={{
            position: 'absolute', width: boxW + 6, height: lidH,
            left: 0, top: 0,
            transformOrigin: 'left bottom',
            transform: isOpen ? 'rotate(-50deg) translateY(-10px)' : 'rotate(0deg)',
            transition: 'transform 0.45s cubic-bezier(0.68,-0.55,0.265,1.55)',
            zIndex: 10,
          }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #e63946 0%, #c1121f 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 50%)' }} />
          </div>
          {/* Gold ribbon horizontal */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: 'linear-gradient(180deg, #f5d060, #c9a530)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.35) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)' }} />
          </div>
          {/* Gold bow */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -ribbonW * 1.6 }}>
            <div className="relative" style={{ width: ribbonW * 4.5, height: ribbonW * 2.8 }}>
              {/* Left loop */}
              <div className="absolute rounded-full" style={{ left: 0, top: ribbonW * 0.2, width: ribbonW * 2, height: ribbonW * 2.2, background: 'linear-gradient(150deg, #f5d060 0%, #c9a530 60%, #a8860c 100%)', transform: 'rotate(-20deg)', border: '1px solid rgba(160,120,20,0.3)' }} />
              {/* Right loop */}
              <div className="absolute rounded-full" style={{ right: 0, top: ribbonW * 0.2, width: ribbonW * 2, height: ribbonW * 2.2, background: 'linear-gradient(210deg, #f5d060 0%, #c9a530 60%, #a8860c 100%)', transform: 'rotate(20deg)', border: '1px solid rgba(160,120,20,0.3)' }} />
              {/* Center knot */}
              <div className="absolute rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/3" style={{ width: ribbonW * 1, height: ribbonW * 1, background: 'radial-gradient(circle at 35% 35%, #ffe08a, #c9a530)', border: '1px solid rgba(160,120,20,0.4)' }} />
              {/* Tail left */}
              <div className="absolute" style={{ left: ribbonW * 0.5, bottom: -ribbonW * 0.4, width: ribbonW * 0.6, height: ribbonW * 1, background: 'linear-gradient(180deg, #d4aa35, #b8922a)', transform: 'rotate(15deg)', borderRadius: '0 0 3px 3px' }} />
              {/* Tail right */}
              <div className="absolute" style={{ right: ribbonW * 0.5, bottom: -ribbonW * 0.4, width: ribbonW * 0.6, height: ribbonW * 1, background: 'linear-gradient(180deg, #d4aa35, #b8922a)', transform: 'rotate(-15deg)', borderRadius: '0 0 3px 3px' }} />
            </div>
          </div>
        </div>

        {/* Box body */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 overflow-hidden" style={{ width: boxW, height: boxH }}>
          {/* Main red gradient */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #e63946 0%, #a4161a 100%)' }} />
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #f5d060 1px, transparent 1px)', backgroundSize: `${boxW * 0.18}px ${boxH * 0.22}px` }} />
          {/* Shine overlay */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 45%)' }} />
          {/* Left edge highlight */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))' }} />
          {/* Right edge shadow */}
          <div className="absolute right-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18))' }} />
          {/* Gold ribbon vertical */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0" style={{ width: ribbonW, background: 'linear-gradient(180deg, #f5d060, #c9a530)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)' }} />
          </div>
          {/* Gold horizontal ribbon */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2" style={{ height: ribbonW, background: 'linear-gradient(90deg, #c9a530, #f5d060 50%, #c9a530)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)' }} />
          </div>
          {/* Top shadow */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent)' }} />
          {/* Bottom edge */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(0,0,0,0.15)' }} />
        </div>
      </div>

      {/* Glow burst */}
      <div
        className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: s * 0.9, height: s * 0.9,
          background: 'radial-gradient(circle, hsl(45 90% 60% / 0.35), hsl(30 90% 50% / 0.12) 50%, transparent 70%)',
          opacity: isOpen ? 1 : 0,
          transform: `translate(-50%,-50%) scale(${isOpen ? 1.5 : 0.4})`,
          transition: 'all 0.6s ease',
        }}
      />

      <style>{`
        @keyframes giftShake {
          0%, 100% { transform: translate(-50%, -45%) rotate(0deg); }
          25% { transform: translate(-50%, -45%) rotate(-3deg) translateX(-2px); }
          75% { transform: translate(-50%, -45%) rotate(3deg) translateX(2px); }
        }
        @keyframes giftConfetti {
          0% { opacity:1; transform: translate(-50%,-50%) translate(0,0) rotate(0) scale(0.2); }
          20% { opacity:1; transform: translate(-50%,-50%) translate(var(--c-tx),var(--c-ty)) rotate(var(--c-rot)) scale(1.1); }
          60% { opacity:1; }
          100% { opacity:0; transform: translate(-50%,-50%) translate(var(--c-tx),var(--c-ty2)) rotate(var(--c-rot2)) scale(0.3); }
        }
        @keyframes giftSparkle {
          0% { opacity:0; transform: translate(-50%,-50%) translate(0,0) scale(0); }
          15% { opacity:1; transform: translate(-50%,-50%) translate(var(--sp-x),0) scale(1.2); }
          50% { opacity:1; }
          100% { opacity:0; transform: translate(-50%,-50%) translate(var(--sp-x),var(--sp-ty)) scale(0); }
        }
        @keyframes giftReward {
          0% { opacity:0; transform: translate(-50%,-50%) translate(0,0) scale(0) rotate(-20deg); }
          25% { opacity:1; transform: translate(-50%,-50%) translate(var(--rw-tx),var(--rw-ty)) scale(1.2) rotate(5deg); }
          50% { opacity:1; transform: translate(-50%,-50%) translate(var(--rw-tx),var(--rw-ty)) scale(1) rotate(0); }
          100% { opacity:0; transform: translate(-50%,-50%) translate(var(--rw-tx),calc(var(--rw-ty) + 25px)) scale(0.6) rotate(10deg); }
        }
      `}</style>
    </div>
  )
}
