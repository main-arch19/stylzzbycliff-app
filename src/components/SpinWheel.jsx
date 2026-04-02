import { useState, useRef, useEffect } from 'react'
import { SPIN_PRIZES } from '@/utils/constants'
import { getPrizeIndex } from '@/utils/helpers'
import { useSpin } from '@/hooks/useSpin'
import { useToast } from './Toast'
import { getErrorMessage } from '@/utils/helpers'

const SEGMENT_COUNT = SPIN_PRIZES.length // 6 segments

export function SpinWheel() {
  const { spin, loading, spinsAvailable, lastPrize, setLastPrize } = useSpin()
  const toast = useToast()
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [prize, setPrize] = useState(null)
  const wheelRef = useRef(null)
  const currentRotationRef = useRef(0)

  const handleSpin = async () => {
    if (spinning || loading || spinsAvailable <= 0) return
    setSpinning(true)
    setPrize(null)

    // Call the RPC first to get the server-determined prize
    const { data, error } = await spin()
    if (error) {
      toast(getErrorMessage(), 'error')
      setSpinning(false)
      return
    }

    const wonPrize = data?.prize || SPIN_PRIZES[0].label
    const prizeIndex = getPrizeIndex(wonPrize)
    const segmentDeg = 360 / SEGMENT_COUNT
    // Land in middle of target segment, after several full rotations
    const targetAngle = 360 - (prizeIndex * segmentDeg + segmentDeg / 2)
    const fullRotations = 5 * 360
    const newRotation = currentRotationRef.current + fullRotations + targetAngle

    currentRotationRef.current = newRotation
    setRotation(newRotation)

    // Show prize after animation completes
    setTimeout(() => {
      setPrize(wonPrize)
      setSpinning(false)
    }, 3200)
  }

  const handleDismiss = () => {
    setPrize(null)
    setLastPrize(null)
  }

  if (spinsAvailable <= 0) return null

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white">
            LUCKY SPIN
          </div>
          <div className="font-mono text-[10px] text-accent mt-0.5">
            {spinsAvailable} SPIN{spinsAvailable !== 1 ? 'S' : ''} AVAILABLE
          </div>
        </div>
        <span className="text-2xl">🎰</span>
      </div>

      {/* Prize reveal overlay */}
      {prize && (
        <div className="text-center py-4 animate-prize-reveal">
          <div className="font-heading text-[11px] tracking-widest uppercase text-warm-grey mb-1">YOU WON</div>
          <div className="font-display text-[28px] text-accent">{prize}</div>
          <button
            onClick={handleDismiss}
            className="mt-3 font-heading text-[11px] tracking-wider uppercase text-clipper-red"
          >
            NICE. SPIN AGAIN? →
          </button>
        </div>
      )}

      {!prize && (
        <div className="flex flex-col items-center gap-4">
          {/* Wheel */}
          <div className="relative">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-clipper-red" />
            </div>

            <div
              ref={wheelRef}
              className="relative w-52 h-52 rounded-full overflow-hidden border-4 border-[#2a2a2a]"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                  : 'none',
                background: `conic-gradient(
                  ${SPIN_PRIZES.map((p, i) => {
                    const startDeg = (i * 360) / SEGMENT_COUNT
                    const endDeg = ((i + 1) * 360) / SEGMENT_COUNT
                    return `${p.color} ${startDeg}deg ${endDeg}deg`
                  }).join(', ')}
                )`,
              }}
            >
              {/* Segment labels */}
              {SPIN_PRIZES.map((p, i) => {
                const angle = (i * 360) / SEGMENT_COUNT + 360 / SEGMENT_COUNT / 2
                const rad = (angle * Math.PI) / 180
                const r = 60
                const x = 104 + r * Math.sin(rad)
                const y = 104 - r * Math.cos(rad)
                return (
                  <div
                    key={p.id}
                    className="absolute text-center"
                    style={{
                      left: x,
                      top: y,
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                      width: 64,
                    }}
                  >
                    <span className="font-heading text-[7px] font-bold text-white uppercase leading-tight block drop-shadow-md">
                      {p.label}
                    </span>
                  </div>
                )
              })}

              {/* Center cap */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-midnight border-2 border-[#2a2a2a] z-10" />
            </div>
          </div>

          <button
            onClick={handleSpin}
            disabled={spinning || loading}
            className="btn btn-primary w-full"
          >
            {spinning ? 'SPINNING...' : `SPIN (${spinsAvailable} LEFT)`}
          </button>
        </div>
      )}
    </div>
  )
}
