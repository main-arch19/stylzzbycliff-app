import { timeUntil } from '@/utils/helpers'
import { useSeasonPass } from '@/hooks/useSeasonPass'

export function SeasonPass() {
  const { seasonPass, progress, loading, tierProgress } = useSeasonPass()

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="h-4 w-40 bg-charcoal animate-skeleton rounded" />
        <div className="h-2 w-full bg-charcoal animate-skeleton rounded" />
      </div>
    )
  }

  if (!seasonPass) {
    return (
      <div className="card p-5 text-center">
        <div className="text-2xl mb-2">🏆</div>
        <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
          No Active Season Pass
        </div>
        <div className="font-body text-[10px] text-warm-grey mt-1">
          Check back soon for the next season.
        </div>
      </div>
    )
  }

  const currentTier = progress?.current_tier || 0
  const tierXp = progress?.tier_xp || 0
  const timeLeft = timeUntil(seasonPass.ends_at)

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[20px] text-cream">{seasonPass.name}</div>
          <div className="font-heading text-[9px] tracking-widest uppercase text-warm-grey mt-0.5">
            {timeLeft}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[28px] text-accent">{currentTier}</div>
          <div className="font-heading text-[9px] uppercase tracking-wider text-warm-grey">
            / {seasonPass.total_tiers} TIERS
          </div>
        </div>
      </div>

      {/* Tier progress bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="font-heading text-[10px] uppercase tracking-wider text-warm-grey">
            TIER {currentTier} → TIER {Math.min(currentTier + 1, seasonPass.total_tiers)}
          </span>
          <span className="font-mono text-[10px] text-accent">
            {tierXp} / {seasonPass.xp_per_tier} XP
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${tierProgress}%` }} />
        </div>
      </div>

      {/* Tier bubbles */}
      <div className="flex gap-1.5 flex-wrap mt-3">
        {Array.from({ length: seasonPass.total_tiers }, (_, i) => {
          const tierNum = i + 1
          const unlocked = tierNum <= currentTier
          return (
            <div
              key={tierNum}
              className={`
                flex items-center justify-center w-7 h-7 rounded-full
                font-heading text-[9px] font-semibold
                ${unlocked
                  ? 'bg-red-gradient text-white'
                  : 'bg-charcoal text-warm-grey border border-line/10'
                }
              `}
            >
              {tierNum}
            </div>
          )
        })}
      </div>
    </div>
  )
}
