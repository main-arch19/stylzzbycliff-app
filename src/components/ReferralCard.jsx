import { Share2, Copy } from 'lucide-react'
import { useToast } from './Toast'
import { formatReferralCode } from '@/utils/helpers'

export function ReferralCard({ referralCode }) {
  const toast = useToast()
  const code = formatReferralCode(referralCode || '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast('Referral code copied!', 'success')
    } catch {
      toast('Could not copy. Try manually.', 'error')
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: 'StylzzByCliff — Stay Fresh, Stay Sharp',
      text: `Use my referral code ${code} when signing up for the StylzzByCliff loyalty app and get 100 bonus XP!`,
      url: window.location.origin,
    }
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
        toast('Link copied to clipboard!', 'success')
      }
    } catch {
      toast('Could not share. Try copying instead.', 'error')
    }
  }

  return (
    <div className="card p-5">
      <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream mb-1">
        REFERRAL PROGRAM
      </div>
      <div className="font-body text-[10px] text-warm-grey mb-4">
        Refer a friend and both of you earn XP. You get +200 XP, they get +100 XP on signup.
      </div>

      {/* Code box */}
      <button
        onClick={handleCopy}
        className="w-full border-2 border-dashed border-clipper-red/50 rounded-[12px] p-4 mb-4 flex items-center justify-between group hover:border-clipper-red transition-colors"
      >
        <div className="flex-1 text-center">
          <div className="font-body text-[9px] uppercase tracking-widest text-warm-grey mb-1">YOUR CODE</div>
          <div className="font-display text-[28px] text-clipper-red tracking-[6px]">{code || 'XXXXXXXX'}</div>
        </div>
        <Copy size={16} className="text-warm-grey group-hover:text-clipper-red transition-colors shrink-0" />
      </button>

      {/* Share button */}
      <button onClick={handleShare} className="btn btn-primary w-full gap-2">
        <Share2 size={16} />
        SHARE REFERRAL LINK
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="text-center p-3 rounded-[8px] bg-midnight">
          <div className="font-mono text-[10px] text-accent">+200 XP</div>
          <div className="font-body text-[9px] text-warm-grey">YOU EARN</div>
        </div>
        <div className="text-center p-3 rounded-[8px] bg-midnight">
          <div className="font-mono text-[10px] text-accent">+100 XP</div>
          <div className="font-body text-[9px] text-warm-grey">THEY EARN</div>
        </div>
      </div>
    </div>
  )
}
