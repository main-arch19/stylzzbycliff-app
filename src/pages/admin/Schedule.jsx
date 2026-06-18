import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { CalendarClock, Scissors, Check, UserX, Link2, Search, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminAppointments } from '@/hooks/useAppointments'
import { useToast } from '@/components/Toast'
import { MOCK_MODE } from '@/lib/mockData'
import { HAIRCUT_STYLES } from '@/utils/constants'

const STATUS = {
  pending:   { label: 'PENDING',   cls: 'badge-pending'   },
  confirmed: { label: 'CONFIRMED', cls: 'badge-confirmed' },
  completed: { label: 'DONE',      cls: 'badge-confirmed' },
  cancelled: { label: 'CANCELLED', cls: 'badge-cancelled' },
  no_show:   { label: 'NO-SHOW',   cls: 'badge-cancelled' },
}

export default function Schedule() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const { dayAppointments, unmatched, loading, complete, markNoShow, link } = useAdminAppointments(date)
  const toast = useToast()

  const handleComplete = async (id, style) => {
    const { data, error } = await complete(id, style)
    if (error) {
      toast(error.message || 'Could not complete. Try again.', 'error')
    } else {
      toast(`Cut logged · +${data?.xp_earned ?? 150} XP`, 'success')
    }
  }

  const handleNoShow = async (id) => {
    const { error } = await markNoShow(id)
    toast(error ? 'Could not update.' : 'Marked as no-show.', error ? 'error' : 'success')
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">SCHEDULE</h1>
          <p className="font-body text-[10px] text-warm-grey mt-1">
            Bookings flow in from the site. Mark them done to log the cut.
          </p>
        </div>
        <input
          type="date"
          aria-label="Schedule date"
          className="input max-w-[180px]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Unmatched queue */}
      {unmatched.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={13} className="text-warning" />
            <span className="section-header">UNMATCHED BOOKINGS ({unmatched.length})</span>
          </div>
          <div className="space-y-3">
            {unmatched.map((a) => (
              <UnmatchedRow key={a.id} appt={a} onLink={link} toast={toast} />
            ))}
          </div>
        </div>
      )}

      {/* Day list */}
      <div className="section-header mb-3">
        {format(new Date(`${date}T00:00:00`), 'EEEE, MMM d')}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-skeleton" />)}</div>
      ) : dayAppointments.length === 0 ? (
        <div className="card py-10 text-center">
          <CalendarClock size={22} className="text-warm-grey mx-auto mb-2" />
          <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
            No appointments this day
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {dayAppointments.map((a) => (
            <ScheduleRow key={a.id} appt={a} onComplete={handleComplete} onNoShow={handleNoShow} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleRow({ appt, onComplete, onNoShow }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(appt.service_name || '')
  const [busy, setBusy] = useState(false)
  const st = STATUS[appt.status] || STATUS.confirmed
  const done = ['completed', 'cancelled', 'no_show'].includes(appt.status)

  const confirm = async () => {
    setBusy(true)
    await onComplete(appt.id, style.trim())
    setBusy(false)
    setOpen(false)
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-heading text-[14px] tracking-wider uppercase text-cream">
            {format(new Date(appt.starts_at), 'h:mm a')}
          </div>
          <div className="font-body text-[11px] text-cream/90 mt-0.5 truncate">
            {appt.customer_name || appt.customer_email || 'Guest'}
          </div>
          <div className="font-body text-[10px] text-warm-grey">
            {appt.service_name || 'Cut'} · {appt.barbers?.name || 'Cliff'}
          </div>
        </div>
        <span className={`badge ${st.cls} shrink-0`}>{st.label}</span>
      </div>

      {!done && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn btn-primary h-9 px-4 text-[11px] gap-1.5"
          >
            <Check size={14} /> COMPLETE
          </button>
          <button
            onClick={() => onNoShow(appt.id)}
            className="btn btn-secondary h-9 px-4 text-[11px] gap-1.5"
          >
            <UserX size={14} /> NO-SHOW
          </button>
        </div>
      )}

      {open && !done && (
        <div className="mt-3 pt-3 border-t border-line/5">
          <div className="font-heading text-[9px] tracking-widest uppercase text-warm-grey mb-2">
            Style logged for this cut
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {HAIRCUT_STYLES.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-pill border font-heading text-[10px] tracking-wider uppercase transition-all ${
                  style === s
                    ? 'border-clipper-red bg-clipper-red/15 text-clipper-red'
                    : 'border-line/10 text-warm-grey hover:border-line/30'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input h-10"
              aria-label="Cut style"
              placeholder="Style..."
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
            <button onClick={confirm} disabled={busy} className="btn btn-primary h-10 px-5 text-[11px] gap-1.5 shrink-0">
              <Scissors size={14} /> {busy ? '...' : 'LOG'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function UnmatchedRow({ appt, onLink, toast }) {
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    if (MOCK_MODE) {
      setCustomers([{ id: 'mock-000-000', username: 'CliffKing', full_name: 'Cliff King' }])
      return
    }
    supabase
      .from('profiles')
      .select('id, username, full_name, email')
      .eq('role', 'customer')
      .order('username')
      .limit(50)
      .then(({ data }) => setCustomers(data || []))
  }, [open])

  const filtered = search.trim()
    ? customers.filter((c) =>
        c.username?.toLowerCase().includes(search.toLowerCase()) ||
        c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()))
    : customers

  const doLink = async (customerId) => {
    const { error } = await onLink(appt.id, customerId)
    toast(error ? 'Could not link.' : 'Linked to customer.', error ? 'error' : 'success')
    setOpen(false)
  }

  return (
    <div className="card p-4 border border-warning/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-body text-[12px] text-cream truncate">
            {appt.customer_name || 'Guest'}
          </div>
          <div className="font-mono text-[10px] text-warm-grey truncate">{appt.customer_email}</div>
          <div className="font-body text-[10px] text-warm-grey mt-0.5">
            {format(new Date(appt.starts_at), 'EEE, MMM d · h:mm a')} · {appt.service_name || 'Cut'}
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn btn-secondary h-9 px-4 text-[11px] gap-1.5 shrink-0"
        >
          <Link2 size={14} /> LINK
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-line/5">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-grey" />
            <input
              className="input h-10 pl-9"
              aria-label="Search customer to link"
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => doLink(c.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-[8px] border border-line/5 bg-charcoal hover:border-clipper-red/40 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-charcoal border border-line/10 flex items-center justify-center text-xs font-bold uppercase text-warm-grey shrink-0">
                  {c.username?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <div className="font-heading text-[12px] tracking-wider uppercase text-cream truncate">{c.username}</div>
                  {c.email && <div className="font-mono text-[9px] text-warm-grey truncate">{c.email}</div>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-3 font-body text-[10px] text-warm-grey">No customers found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
