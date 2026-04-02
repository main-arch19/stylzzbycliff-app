import { calcProgress } from '@/utils/helpers'

export function BadgeGrid({ badges, earnedBadges = [], totalCuts, currentStreak }) {
  const earnedIds = new Set(earnedBadges.map((eb) => eb.badge_id))

  const getProgress = (badge) => {
    switch (badge.criteria_type) {
      case 'cuts_count': return calcProgress(totalCuts || 0, badge.criteria_value)
      case 'streak': return calcProgress(currentStreak || 0, badge.criteria_value)
      default: return 0
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((badge) => {
        const earned = earnedIds.has(badge.id)
        const pct = earned ? 100 : getProgress(badge)

        return (
          <div
            key={badge.id}
            className={`card p-3 border transition-all duration-200 ${
              earned
                ? 'border-accent/40 shadow-glow-gold'
                : 'border-white/5 opacity-60'
            }`}
          >
            <div className="text-2xl mb-2">{badge.icon}</div>
            <div className="font-heading text-[11px] font-semibold tracking-wider uppercase text-white mb-1 leading-tight">
              {badge.name}
            </div>
            <div className="font-body text-[9px] text-warm-grey mb-2 line-clamp-2">
              {badge.description}
            </div>

            {!earned && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}

            {earned && (
              <div className="font-heading text-[9px] tracking-wider uppercase text-accent">
                EARNED ✓
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
