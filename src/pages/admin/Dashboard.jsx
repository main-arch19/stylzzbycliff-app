import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  CalendarClock, Scissors, DollarSign, Bell, RefreshCw, Globe, Check, UserX,
  CheckSquare, Link2, Tag, AlertTriangle, Users, BarChart2, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBarberDashboard } from '@/hooks/useBarberDashboard'
import { useAdminAppointments } from '@/hooks/useAppointments'
import { useToast } from '@/components/Toast'

const STATUS = {
  pending:   'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-confirmed',
  cancelled: 'badge-cancelled',
  no_show:   'badge-cancelled',
}

const money = (cents) => `$${Math.round((cents || 0) / 100)}`

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { stats, websiteBookings, loading, refetch } = useBarberDashboard()
  const today = new Date().toISOString().split('T')[0]
  const { dayAppointments, complete, markNoShow, refetch: refetchDay } = useAdminAppointments(today)
  const toast = useToast()

  // "NEW" = arrived since the barber last opened the dashboard.
  const seenRef = useRef(Number(localStorage.getItem('barber_bookings_seen_at')) || 0)
  useEffect(() => { localStorage.setItem('barber_bookings_seen_at', String(Date.now())) }, [])
  const isNew = (a) => a.created_at && new Date(a.created_at).getTime() > seenRef.current

  const attention =
    (stats?.pending_approvals || 0) +
    (stats?.unmatched_bookings || 0) +
    (stats?.pending_redemptions || 0) +
    (stats?.decay_risk || 0)

  const refreshAll = () => { refetch(); refetchDay() }

  const handleComplete = async (id) => {
    const { data, error } = await complete(id)
    toast(error ? (error.message || 'Could not complete.') : `Cut logged · +${data?.xp_earned ?? 150} XP`, error ? 'error' : 'success')
    refetch()
  }
  const handleNoShow = async (id) => {
    const { error } = await markNoShow(id)
    toast(error ? 'Could not update.' : 'Marked as no-show.', error ? 'error' : 'success')
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="font-body text-[11px] text-warm-grey">{greeting()},</div>
          <h1 className="font-display text-[28px] text-cream uppercase tracking-wider leading-tight">
            {profile?.username || 'Cliff'}
          </h1>
          <div className="font-body text-[10px] text-warm-grey mt-0.5">{format(new Date(), 'EEEE, MMM d')}</div>
        </div>
        <button
          onClick={refreshAll}
          aria-label="Refresh dashboard"
          className="p-2 rounded-[8px] text-warm-grey hover:text-cream transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi icon={<CalendarClock size={15} className="text-clipper-red" />} value={stats?.appointments_today ?? '—'} label="TODAY" loading={loading} />
        <Kpi icon={<Scissors size={15} className="text-accent" />} value={stats?.cuts_today ?? '—'} label="CUTS TODAY" loading={loading} />
        <Kpi icon={<DollarSign size={15} className="text-success" />} value={money(stats?.tips_today_cents)} label="TIPS TODAY" loading={loading} />
        <Kpi icon={<Bell size={15} className="text-warning" />} value={attention} label="TO HANDLE" loading={loading} />
      </div>

      {/* Next up */}
      {stats?.next_appointment && (
        <div className="card p-3 mb-6 flex items-center gap-3 border border-clipper-red/20">
          <div className="w-9 h-9 rounded-[8px] bg-clipper-red/15 flex items-center justify-center shrink-0">
            <CalendarClock size={16} className="text-clipper-red" />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-[9px] tracking-widest uppercase text-warm-grey">NEXT UP</div>
            <div className="font-heading text-[13px] tracking-wider uppercase text-cream truncate">
              {format(new Date(stats.next_appointment.starts_at), 'h:mm a')} · {stats.next_appointment.customer_name || 'Guest'}
              <span className="text-warm-grey"> · {stats.next_appointment.service_name || 'Cut'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Website bookings — the headline feature */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-accent" />
            <span className="section-header">FROM THE WEBSITE</span>
            {stats?.website_bookings_upcoming > 0 && (
              <span className="badge badge-premium">{stats.website_bookings_upcoming}</span>
            )}
          </div>
          <Link to="/admin/schedule" className="font-heading text-[9px] tracking-wider uppercase text-warm-grey hover:text-cream inline-flex items-center gap-1">
            VIEW ALL <ChevronRight size={11} />
          </Link>
        </div>

        {websiteBookings.length === 0 ? (
          <div className="card py-8 text-center">
            <Globe size={20} className="text-warm-grey mx-auto mb-2" />
            <div className="font-heading text-[11px] tracking-wider uppercase text-warm-grey">No website bookings yet</div>
            <div className="font-body text-[10px] text-warm-grey mt-1">New calendar bookings land here.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {websiteBookings.map((a) => {
              const unmatched = !a.customer_id
              return (
                <div key={a.id} className="card p-3 flex items-center gap-3 border border-accent/15">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-[12px] tracking-wider uppercase text-cream truncate">
                        {format(new Date(a.starts_at), 'EEE, MMM d · h:mm a')}
                      </span>
                      {isNew(a) && <span className="badge badge-premium">NEW</span>}
                    </div>
                    <div className="font-body text-[10px] text-warm-grey truncate">
                      {a.service_name || 'Cut'} ·{' '}
                      {unmatched
                        ? <span className="text-warning">{a.customer_name || a.customer_email} · needs linking</span>
                        : (a.customer_name || 'Customer')}
                    </div>
                  </div>
                  {unmatched && (
                    <Link to="/admin/schedule" aria-label="Link booking" className="p-2 rounded-[8px] text-warning hover:bg-warning/10 shrink-0">
                      <Link2 size={15} />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Needs attention */}
      <div className="mb-6">
        <div className="section-header mb-3">NEEDS ATTENTION</div>
        <div className="card divide-y divide-line/5">
          <AttentionRow to="/admin/approvals" icon={<CheckSquare size={15} className="text-clipper-red" />} label="Cut approvals" count={stats?.pending_approvals} />
          <AttentionRow to="/admin/schedule" icon={<Link2 size={15} className="text-warning" />} label="Unmatched bookings" count={stats?.unmatched_bookings} />
          <AttentionRow to="/admin/redeem" icon={<Tag size={15} className="text-accent" />} label="Rewards to redeem" count={stats?.pending_redemptions} />
          <AttentionRow to="/admin/customers" icon={<AlertTriangle size={15} className="text-warning" />} label="At decay risk" count={stats?.decay_risk} />
          {attention === 0 && !loading && (
            <div className="p-4 text-center font-body text-[10px] text-warm-grey">All clear, King. 🔥</div>
          )}
        </div>
      </div>

      {/* Today's chair */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="section-header">TODAY'S CHAIR</span>
          <Link to="/admin/schedule" className="font-heading text-[9px] tracking-wider uppercase text-warm-grey hover:text-cream inline-flex items-center gap-1">
            FULL SCHEDULE <ChevronRight size={11} />
          </Link>
        </div>
        {dayAppointments.length === 0 ? (
          <div className="card py-8 text-center font-body text-[10px] text-warm-grey">No appointments today.</div>
        ) : (
          <div className="space-y-2">
            {dayAppointments.map((a) => {
              const active = ['pending', 'confirmed'].includes(a.status)
              return (
                <div key={a.id} className="card p-3 flex items-center gap-3">
                  <div className="font-heading text-[12px] tracking-wider uppercase text-cream w-16 shrink-0">
                    {format(new Date(a.starts_at), 'h:mm a')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-[11px] text-cream truncate">{a.customer_name || a.customer_email || 'Guest'}</div>
                    <div className="font-body text-[9px] text-warm-grey truncate">{a.service_name || 'Cut'}</div>
                  </div>
                  {active ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleComplete(a.id)} aria-label="Complete" className="p-2 rounded-[8px] bg-success/15 text-success hover:bg-success/25">
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleNoShow(a.id)} aria-label="No-show" className="p-2 rounded-[8px] bg-line/5 text-warm-grey hover:text-error">
                        <UserX size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className={`badge ${STATUS[a.status] || 'badge-confirmed'} shrink-0`}>{a.status.replace('_', '-')}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <div className="section-header mb-3">QUICK ACTIONS</div>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction to="/admin/log" icon={<Scissors size={18} />} label="LOG WALK-IN" />
          <QuickAction to="/admin/schedule" icon={<CalendarClock size={18} />} label="SCHEDULE" />
          <QuickAction to="/admin/redeem" icon={<Tag size={18} />} label="REDEEM" />
          <QuickAction to="/admin/customers" icon={<Users size={18} />} label="CUSTOMERS" />
          <QuickAction to="/admin/analytics" icon={<BarChart2 size={18} />} label="ANALYTICS" />
          <QuickAction to="/admin/approvals" icon={<CheckSquare size={18} />} label="APPROVALS" />
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, value, label, loading }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      {icon}
      <div className="font-display text-[24px] text-cream leading-none">{loading ? '—' : value}</div>
      <div className="font-heading text-[8px] tracking-widest uppercase text-warm-grey">{label}</div>
    </div>
  )
}

function AttentionRow({ to, icon, label, count }) {
  if (!count) return null
  return (
    <Link to={to} className="flex items-center gap-3 p-3.5 hover:bg-line/5 transition-colors">
      <div className="w-8 h-8 rounded-[8px] bg-midnight flex items-center justify-center shrink-0">{icon}</div>
      <span className="font-heading text-[12px] tracking-wider uppercase text-cream flex-1">{label}</span>
      <span className="font-mono text-[13px] text-cream">{count}</span>
      <ChevronRight size={14} className="text-warm-grey" />
    </Link>
  )
}

function QuickAction({ to, icon, label }) {
  return (
    <Link to={to} className="card p-4 flex flex-col items-center justify-center gap-2 text-warm-grey hover:text-cream hover:border-clipper-red/30 transition-all">
      <span className="text-clipper-red">{icon}</span>
      <span className="font-heading text-[9px] tracking-wider uppercase text-center">{label}</span>
    </Link>
  )
}
