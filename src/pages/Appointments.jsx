import { format, isToday, isTomorrow } from 'date-fns'
import { CalendarClock, Scissors, User, X, CheckCircle2, Heart } from 'lucide-react'
import { useAppointments } from '@/hooks/useAppointments'
import { useTip } from '@/hooks/useTip'
import { useToast } from '@/components/Toast'
import ThemeToggle from '@/components/ThemeToggle'

const TIP_PRESETS = [300, 500, 1000] // cents

const STATUS = {
  pending:   { label: 'PENDING',   cls: 'badge-pending'   },
  confirmed: { label: 'CONFIRMED', cls: 'badge-confirmed' },
  completed: { label: 'DONE',      cls: 'badge-confirmed' },
  cancelled: { label: 'CANCELLED', cls: 'badge-cancelled' },
  no_show:   { label: 'NO-SHOW',   cls: 'badge-cancelled' },
}

function whenLabel(iso) {
  const d = new Date(iso)
  const time = format(d, 'h:mm a')
  if (isToday(d)) return `Today · ${time}`
  if (isTomorrow(d)) return `Tomorrow · ${time}`
  return `${format(d, 'EEE, MMM d')} · ${time}`
}

export default function Appointments() {
  const { upcoming, past, loading, cancel } = useAppointments()
  const { tip, loading: tipping } = useTip()
  const toast = useToast()

  const handleCancel = async (id) => {
    const { error } = await cancel(id)
    toast(error ? 'Could not cancel. Try again.' : 'Appointment cancelled.', error ? 'error' : 'success')
  }

  const handleTip = async (appt, cents) => {
    const { error, simulated } = await tip(appt.id, cents)
    if (error) toast('Could not start payment. Try again.', 'error')
    else if (simulated) toast('Thanks for the love 🙏 (demo tip)', 'success')
  }

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 bg-midnight sticky top-0 z-10 border-b border-line/5 flex items-center justify-between">
        <div>
          <div className="font-display text-[28px] text-cream uppercase tracking-wider leading-tight">
            APPOINTMENTS
          </div>
          <div className="font-body text-[10px] text-warm-grey mt-0.5">
            Your chair time — book on the site, track it here.
          </div>
        </div>
        <ThemeToggle className="mt-1" />
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* Upcoming */}
        <div>
          <div className="section-header mb-3">UPCOMING</div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="card h-20 animate-skeleton" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="card py-8 text-center">
              <CalendarClock size={22} className="text-warm-grey mx-auto mb-2" />
              <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
                Nothing booked yet
              </div>
              <div className="font-body text-[10px] text-warm-grey mt-1">
                Book a cut and it'll show up right here.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((a) => (
                <AppointmentCard key={a.id} appt={a} onCancel={() => handleCancel(a.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Past */}
        {past.length > 0 && (
          <div>
            <div className="section-header mb-3">HISTORY</div>
            <div className="space-y-3">
              {past.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  past
                  onTip={(cents) => handleTip(a, cents)}
                  tipping={tipping}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AppointmentCard({ appt, onCancel, onTip, tipping, past }) {
  const st = STATUS[appt.status] || STATUS.confirmed
  const barberName = appt.barbers?.name || 'Cliff'

  return (
    <div className={`card p-4 ${past ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={13} className="text-clipper-red shrink-0" />
            <span className="font-heading text-[13px] tracking-wider uppercase text-cream truncate">
              {whenLabel(appt.starts_at)}
            </span>
          </div>
          <div className="flex items-center gap-3 font-body text-[11px] text-warm-grey">
            <span className="inline-flex items-center gap-1">
              <Scissors size={11} /> {appt.service_name || 'Cut'}
            </span>
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {barberName}
            </span>
          </div>
        </div>
        <span className={`badge ${st.cls} shrink-0`}>{st.label}</span>
      </div>

      {appt.status === 'completed' && (
        <>
          <div className="flex items-center gap-1.5 mt-3 font-mono text-[10px] text-success">
            <CheckCircle2 size={12} /> Logged · +150 XP
          </div>
          {onTip && (
            <div className="mt-3 pt-3 border-t border-line/5">
              <div className="flex items-center gap-1.5 font-heading text-[9px] tracking-widest uppercase text-warm-grey mb-2">
                <Heart size={11} className="text-clipper-red" /> Tip {barberName}
              </div>
              <div className="flex gap-2">
                {TIP_PRESETS.map((cents) => (
                  <button
                    key={cents}
                    onClick={() => onTip(cents)}
                    disabled={tipping}
                    className="flex-1 py-2 rounded-pill border border-line/10 font-heading text-[11px] tracking-wider text-cream hover:border-clipper-red/40 hover:text-clipper-red transition-all disabled:opacity-50"
                  >
                    ${(cents / 100).toFixed(0)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {onCancel && ['pending', 'confirmed'].includes(appt.status) && (
        <button
          onClick={onCancel}
          className="mt-3 inline-flex items-center gap-1.5 font-heading text-[10px] tracking-wider uppercase text-warm-grey hover:text-error transition-colors"
        >
          <X size={12} /> Cancel
        </button>
      )}
    </div>
  )
}
