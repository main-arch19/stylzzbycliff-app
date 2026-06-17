import { useEffect } from 'react'
import { MapPin, Check } from 'lucide-react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { useToast } from './Toast'
import { getCheckInSuccessMessage, getErrorMessage } from '@/utils/helpers'

export function CheckInButton() {
  const { checkIn, loading, checkedInToday, checkIfCheckedInToday } = useCheckIn()
  const toast = useToast()

  useEffect(() => { checkIfCheckedInToday() }, [checkIfCheckedInToday])

  const handleCheckIn = async () => {
    if (checkedInToday || loading) return
    const { data, error } = await checkIn()
    if (error) {
      toast(getErrorMessage(), 'error')
    } else if (data?.success === false) {
      toast("You already checked in today, King.", 'info')
    } else {
      toast(getCheckInSuccessMessage(), 'success')
    }
  }

  if (checkedInToday) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-[12px] border border-success/30 bg-success/5">
        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
          <Check size={18} className="text-success" />
        </div>
        <div>
          <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-success">
            YOU'RE LOCKED IN
          </div>
          <div className="font-body text-[10px] text-warm-grey mt-0.5">
            Check-in complete · +50 XP earned
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={loading}
      className={`
        w-full flex items-center gap-3 p-4 rounded-[12px]
        border border-clipper-red/50 bg-clipper-red/5
        transition-all duration-200 text-left
        hover:border-clipper-red hover:bg-clipper-red/10
        active:scale-[0.98]
        ${loading ? 'opacity-60' : 'animate-pulse-glow'}
      `}
    >
      <div className="w-10 h-10 rounded-full bg-clipper-red/20 flex items-center justify-center shrink-0">
        <MapPin size={18} className="text-clipper-red" />
      </div>
      <div className="flex-1">
        <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream">
          {loading ? 'CHECKING IN...' : 'CHECK IN AT SHOP'}
        </div>
        <div className="font-mono text-[10px] text-accent mt-0.5">+50 XP</div>
      </div>
      <div className="font-heading text-[10px] tracking-wider uppercase text-clipper-red">
        TAP →
      </div>
    </button>
  )
}
