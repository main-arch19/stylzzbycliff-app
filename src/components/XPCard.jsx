import { ProgressRing } from './ProgressRing'
import { AnimatedNumber } from './AnimatedNumber'
import { getTierInfo } from '@/utils/helpers'
import { getTierForCuts, getCutsToNextTier } from '@/utils/constants'

export function XPCard({ profile, loading }) {
  if (loading || !profile) return <XPCardSkeleton />

  const tier = profile.membership_tier || 'bronze'
  const tierInfo = getTierInfo(tier)
  const nextTier = getCutsToNextTier(profile.total_cuts)
  const nextTierInfo = getTierInfo(getTierForCuts(profile.total_cuts + (nextTier || 1)))

  // XP progress within current tier (visual only — based on cuts to next tier)
  const maxCuts = nextTierInfo.minCuts || 30
  const minCuts = tierInfo.minCuts || 0
  const progress = nextTier === 0
    ? 100
    : Math.round(((profile.total_cuts - minCuts) / (maxCuts - minCuts)) * 100)

  return (
    <div className="card p-5 relative overflow-hidden">
      {/* Subtle red glow top-right */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-clipper-red/10 blur-2xl pointer-events-none" />

      <div className="flex items-center gap-5">
        {/* Progress Ring */}
        <ProgressRing progress={Math.max(0, Math.min(100, progress))} size={100} strokeWidth={7}>
          <div className="flex flex-col items-center">
            <AnimatedNumber
              value={profile.total_xp}
              className="font-display text-[22px] text-cream leading-none"
            />
            <span className="font-heading text-[8px] text-warm-grey tracking-widest uppercase mt-0.5">XP</span>
          </div>
        </ProgressRing>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Tier badge */}
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-pill font-heading text-[9px] font-semibold tracking-widest uppercase mb-2"
            style={{ background: tierInfo.bg, color: tierInfo.color }}
          >
            {tierInfo.label}
          </span>

          <div className="font-heading text-[11px] text-warm-grey uppercase tracking-wide mb-1">
            {nextTier === 0
              ? 'MAX TIER UNLOCKED'
              : `${nextTier} CUT${nextTier !== 1 ? 'S' : ''} TO ${nextTierInfo.label}`
            }
          </div>

          {/* Progress bar */}
          <div className="progress-track mt-2">
            <div
              className="progress-fill"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>

          {/* Total XP label */}
          <div className="flex justify-between mt-1.5">
            <span className="font-mono text-[9px] text-warm-grey">{profile.total_xp.toLocaleString()} XP TOTAL</span>
            {nextTier > 0 && (
              <span className="font-mono text-[9px] text-accent">{nextTierInfo.label} →</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function XPCardSkeleton() {
  return (
    <div className="card p-5 flex items-center gap-5">
      <div className="w-[100px] h-[100px] rounded-full bg-charcoal animate-skeleton shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-20 bg-charcoal animate-skeleton rounded" />
        <div className="h-3 w-32 bg-charcoal animate-skeleton rounded" />
        <div className="h-1.5 w-full bg-charcoal animate-skeleton rounded" />
      </div>
    </div>
  )
}
