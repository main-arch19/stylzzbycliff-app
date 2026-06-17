import { Lock, CheckCircle } from 'lucide-react'
import { calcProgress } from '@/utils/helpers'

export function RewardCard({ reward, totalCuts, isClaimed, isRedeemed, onClaim, claiming }) {
  const isUnlocked = totalCuts >= reward.cuts_required
  const pct = calcProgress(totalCuts, reward.cuts_required)

  return (
    <div
      className={`card p-4 border transition-all duration-200 ${
        isUnlocked && !isClaimed
          ? 'border-accent/40 shadow-glow-gold'
          : isRedeemed
          ? 'border-success/20 opacity-60'
          : 'border-line/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{reward.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream truncate">
            {reward.name}
          </div>
          <div className="font-mono text-[10px] text-accent">
            {reward.cuts_required} CUT{reward.cuts_required !== 1 ? 'S' : ''} REQUIRED
          </div>
        </div>
        {isRedeemed ? (
          <CheckCircle size={18} className="text-success shrink-0" />
        ) : isUnlocked ? (
          <div className="w-2 h-2 rounded-full bg-accent shrink-0 shadow-glow-gold" />
        ) : (
          <Lock size={14} className="text-warm-grey shrink-0" />
        )}
      </div>

      {/* Description */}
      {reward.description && (
        <div className="font-body text-[10px] text-warm-grey mb-3">{reward.description}</div>
      )}

      {/* Progress bar */}
      {!isUnlocked && (
        <div className="mb-3">
          <div className="progress-track mb-1">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[8px] text-warm-grey">{totalCuts} cuts</span>
            <span className="font-mono text-[8px] text-warm-grey">{reward.cuts_required} cuts</span>
          </div>
        </div>
      )}

      {/* Action */}
      {isUnlocked && !isClaimed && !isRedeemed && (
        <button
          onClick={() => onClaim(reward.id)}
          disabled={claiming}
          className="btn btn-premium w-full text-[12px]"
        >
          {claiming ? 'CLAIMING...' : 'CLAIM REWARD'}
        </button>
      )}
      {isClaimed && !isRedeemed && (
        <div className="font-heading text-[11px] tracking-wider uppercase text-accent text-center py-2">
          CLAIMED — SHOW BARBER TO REDEEM
        </div>
      )}
      {isRedeemed && (
        <div className="font-heading text-[11px] tracking-wider uppercase text-success text-center py-2">
          ✓ REDEEMED
        </div>
      )}
    </div>
  )
}
