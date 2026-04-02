import { Scissors } from 'lucide-react'
import { formatRelativeDate } from '@/utils/helpers'

export function CutHistoryRow({ cut }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-9 h-9 rounded-full bg-clipper-red/10 flex items-center justify-center shrink-0">
        <Scissors size={14} className="text-clipper-red" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-heading text-[13px] font-medium tracking-wider uppercase text-white truncate">
          {cut.style}
        </div>
        <div className="font-body text-[9px] text-warm-grey mt-0.5">
          {cut.barbers?.name || 'Cliff'} · {formatRelativeDate(cut.created_at)}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-mono text-[12px] font-medium text-accent">+{cut.xp_earned}</div>
        <div className="font-body text-[8px] uppercase tracking-wider text-warm-grey">XP</div>
      </div>
    </div>
  )
}

export function CutHistoryRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-9 h-9 rounded-full bg-charcoal animate-skeleton shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 bg-charcoal animate-skeleton rounded" />
        <div className="h-2 w-20 bg-charcoal animate-skeleton rounded" />
      </div>
      <div className="h-3 w-10 bg-charcoal animate-skeleton rounded" />
    </div>
  )
}
