import { useEffect, useState, useMemo } from 'react'

export default function AnimatedGiftBox({ size = 96, className = '' }: { size?: number; className?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>
    let interval: ReturnType<typeof setInterval>

    const trigger = () => {
      setOpen(true)
      closeTimer = setTimeout(() => setOpen(false), 2200)
    }

    const initial = setTimeout(() => {
      trigger()
      interval = setInterval(trigger, 6000)
    }, 2500)

    return () => { clearTimeout(initial); clearTimeout(closeTimer); clearInterval(interval) }
  }, [])

  const confetti = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * 360
      const rad = (angle * Math.PI) / 180
      const dist = 35 + Math.random() * 45
      return {
        id: i,
        color: ['#ef4444', '#eab308', '#3b82f6', '#10b981', '#a855f7', '#f97316'][i % 6],
        tx: Math.cos(rad) * dist,
        ty: Math.sin(rad) * dist - 15,
        size: 4 + Math.random() * 3,
        delay: Math.random() * 200,
        rot: Math.random() * 540 - 270,
        shape: i % 3,
      }
    }), [])

  const s = size
  const boxW = s * 0.52
  const boxH = s * 0.38
  const lidH = s * 0.16
  const ribbonW = s * 0.07

  return (
    <div className={`relative ${className}`} style={{ width: s, height: s }}>
      {/* Confetti particles */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '38%',
            width: c.shape === 2 ? c.size * 1.8 : c.size,
            height: c.size,
            borderRadius: c.shape === 0 ? '50%' : '1.5px',
            background: c.color,
            opacity: open ? 0 : 0,
            transform: `translate(-50%, -50%) translate(${open ? c.tx : 0}px, ${open ? c.ty + 50 : 0}px) rotate(${open ? c.rot : 0}deg) scale(${open ? 0.4 : 0})`,
            transition: open
              ? `opacity 0.15s ease ${c.delay}ms, transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${c.delay}ms`
              : 'all 0.2s ease',
            ...(open ? { opacity: 1, animation: `confFade 1.3s ease-out ${c.delay}ms forwards` } : {}),
          }}
        />
      ))}

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
            transform: open ? 'rotate(-40deg) translateY(-6px)' : 'rotate(0deg)',
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

      {/* Glow */}
      <div
        className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: s * 0.7,
          height: s * 0.7,
          background: 'radial-gradient(circle, hsl(45 90% 60% / 0.25), transparent 70%)',
          opacity: open ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${open ? 1.4 : 0.5})`,
          transition: 'all 0.5s ease',
        }}
      />

      <style>{`
        @keyframes confFade {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
