import { getTierInfo, formatXP } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'

export function LeaderboardRow({ entry, index }) {
  const { user } = useAuth()
  const isMe = entry.id === user?.id
  const rank = entry.rank || index + 1
  const tierInfo = getTierInfo(entry.membership_tier)

  const rankDisplay = () => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return rank
  }

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-[12px] border transition-all duration-200
        ${isMe
          ? 'border-clipper-red/50 bg-clipper-red/5'
          : 'border-line/5 bg-charcoal'
        }
      `}
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {typeof rankDisplay() === 'string' ? (
          <span className="text-lg">{rankDisplay()}</span>
        ) : (
          <span className={`font-mono text-[13px] font-medium ${rank <= 3 ? 'text-accent' : 'text-warm-grey'}`}>
            #{rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold uppercase
          ${isMe ? 'bg-clipper-red/30 text-clipper-red' : 'bg-charcoal text-warm-grey border border-line/10'}`}
      >
        {entry.username?.[0] || '?'}
      </div>

      {/* Name & tier */}
      <div className="flex-1 min-w-0">
        <div className={`font-heading text-[13px] font-semibold tracking-wider uppercase truncate ${isMe ? 'text-cream' : 'text-text-primary'}`}>
          {entry.username}
          {isMe && <span className="ml-1.5 text-[9px] text-clipper-red normal-case font-body">you</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="font-heading text-[8px] px-1.5 py-0.5 rounded-pill uppercase tracking-wider"
            style={{ background: tierInfo.bg, color: tierInfo.color }}
          >
            {tierInfo.label}
          </span>
          {entry.current_streak > 0 && (
            <span className="font-mono text-[8px] text-warm-grey">🔥 {entry.current_streak}</span>
          )}
        </div>
      </div>

      {/* XP */}
      <div className="text-right shrink-0">
        <div className={`font-mono text-[13px] font-medium ${rank <= 3 ? 'text-accent' : 'text-cream'}`}>
          {formatXP(entry.total_xp)}
        </div>
        <div className="font-body text-[8px] text-warm-grey uppercase tracking-wide">XP</div>
      </div>
    </div>
  )
}
