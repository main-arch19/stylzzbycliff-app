import { useEffect } from 'react'

// Pure-CSS confetti particles — no external deps
const CONFETTI_COUNT = 24
const CONFETTI_COLORS = ['#C0392B', '#D4A03C', '#A0C8FF', '#27AE60', '#FFFFFF', '#E67E22']

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
        const color  = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        const left   = `${(i * 4.2 + Math.sin(i) * 3) % 100}%`
        const delay  = `${(i * 0.17) % 1.8}s`
        const dur    = `${1.8 + (i % 4) * 0.4}s`
        const size   = i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left,
              width:  size,
              height: size,
              background: color,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
              animation: `hof-fall ${dur} ${delay} ease-in forwards`,
            }}
          />
        )
      })}
    </div>
  )
}

export function HallOfFameModal({ hofCount, onClose }) {
  // Auto-close after 5 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <>
      <style>{`
        @keyframes hof-fall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes hof-badge-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes hof-glow {
          0%, 100% { box-shadow: 0 0 24px 4px rgba(160,200,255,0.3); }
          50%       { box-shadow: 0 0 48px 12px rgba(160,200,255,0.6); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={onClose}
      >
        <Confetti />

        {/* Card */}
        <div
          className="relative z-10 text-center px-8 py-10 mx-6 rounded-[20px]"
          style={{
            background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
            border: '1px solid rgba(160,200,255,0.3)',
            animation: 'hof-badge-pop 0.5s ease-out forwards, hof-glow 2s ease-in-out 0.5s infinite',
            maxWidth: 320,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[64px] leading-none mb-3">🏆</div>

          <div
            className="font-display text-[28px] tracking-widest uppercase mb-1"
            style={{ color: '#A0C8FF' }}
          >
            HALL OF FAME
          </div>

          <div className="font-heading text-[11px] tracking-widest uppercase text-warm-grey mb-4">
            YOU BEAT THE GAME
          </div>

          {hofCount > 1 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill mb-4"
              style={{ background: 'rgba(160,200,255,0.1)', border: '1px solid rgba(160,200,255,0.25)' }}
            >
              <span className="font-display text-[14px]" style={{ color: '#A0C8FF' }}>
                ×{hofCount}
              </span>
              <span className="font-heading text-[9px] tracking-wider uppercase text-warm-grey">
                COMPLETIONS
              </span>
            </div>
          )}

          <div className="font-body text-[12px] text-warm-grey mb-6">
            Your counter has been reset. The run starts again.
          </div>

          <button
            onClick={onClose}
            className="font-heading text-[11px] tracking-widest uppercase px-6 py-2.5 rounded-pill transition-all"
            style={{
              background: 'rgba(160,200,255,0.15)',
              color: '#A0C8FF',
              border: '1px solid rgba(160,200,255,0.3)',
            }}
          >
            LET'S GO AGAIN
          </button>
        </div>
      </div>
    </>
  )
}
