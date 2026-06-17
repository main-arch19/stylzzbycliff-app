import { timeUntil, calcProgress } from '@/utils/helpers'

export function ChallengeCard({ challenge, progress = {} }) {
  const currentVal = progress.current_value || 0
  const isCompleted = progress.completed || false
  const pct = calcProgress(currentVal, challenge.target_value)
  const timeLeft = timeUntil(challenge.ends_at)

  return (
    <div className={`card p-4 border ${isCompleted ? 'border-success/30' : 'border-line/5'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream truncate">
            {challenge.name}
          </div>
          <div className="font-body text-[10px] text-warm-grey mt-0.5 line-clamp-2">
            {challenge.description}
          </div>
        </div>
        <span
          className={`shrink-0 font-heading text-[8px] font-semibold tracking-wider uppercase px-2 py-1 rounded-pill ${
            isCompleted
              ? 'bg-success/20 text-success'
              : timeLeft === 'ENDED'
              ? 'bg-error/20 text-error'
              : 'bg-clipper-red/20 text-clipper-red'
          }`}
        >
          {isCompleted ? 'DONE ✓' : timeLeft}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-2">
        <div
          className={`progress-fill ${isCompleted ? 'progress-fill-gold' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-warm-grey">
          {currentVal} / {challenge.target_value}
        </span>
        {challenge.reward_xp > 0 && (
          <span className="font-mono text-[9px] text-accent">+{challenge.reward_xp} XP</span>
        )}
      </div>
    </div>
  )
}

export function ChallengeCardSkeleton() {
  return (
    <div className="card p-4 space-y-2">
      <div className="h-4 w-40 bg-charcoal animate-skeleton rounded" />
      <div className="h-3 w-full bg-charcoal animate-skeleton rounded" />
      <div className="h-1.5 w-full bg-charcoal animate-skeleton rounded" />
    </div>
  )
}
