import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_APPOINTMENTS } from '@/lib/mockData'

const ACTIVE_STATUSES = ['pending', 'confirmed']

function isUpcoming(appt) {
  return ACTIVE_STATUSES.includes(appt.status) &&
    new Date(appt.starts_at).getTime() >= Date.now()
}

// ─── Customer: my upcoming + past appointments ────────────────────
export function useAppointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState(
    MOCK_MODE ? MOCK_APPOINTMENTS.filter((a) => a.customer_id === 'mock-000-000') : []
  )
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchAppointments = useCallback(async () => {
    if (MOCK_MODE) return
    if (!user?.id) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('appointments')
      .select('*, barbers (name, avatar_url)')
      .eq('customer_id', user.id)
      .order('starts_at', { ascending: true })
    if (err) { setError(err) } else { setAppointments(data || []) }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const cancel = useCallback(async (id) => {
    if (MOCK_MODE) {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' } : a))
      return { error: null }
    }
    const { error: err } = await supabase.rpc('cancel_appointment', { p_appointment_id: id })
    if (!err) await fetchAppointments()
    return { error: err }
  }, [fetchAppointments])

  const upcoming = appointments
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const past = appointments
    .filter((a) => !isUpcoming(a))
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))

  return { upcoming, past, loading, error, refetch: fetchAppointments, cancel }
}

// ─── Admin: a day's schedule + the unmatched queue ────────────────
export function useAdminAppointments(dateStr) {
  const [dayAppointments, setDayAppointments] = useState([])
  const [unmatched, setUnmatched] = useState([])
  const [loading, setLoading] = useState(!MOCK_MODE)

  const fetchSchedule = useCallback(async () => {
    if (MOCK_MODE) {
      setDayAppointments(MOCK_APPOINTMENTS)
      setUnmatched(MOCK_APPOINTMENTS.filter((a) => !a.customer_id && a.status !== 'cancelled'))
      setLoading(false)
      return
    }
    setLoading(true)
    const dayStart = new Date(`${dateStr}T00:00:00`)
    const dayEnd = new Date(`${dateStr}T23:59:59`)

    const [{ data: day }, { data: pending }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, barbers (name, avatar_url)')
        .gte('starts_at', dayStart.toISOString())
        .lte('starts_at', dayEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('appointments')
        .select('*, barbers (name, avatar_url)')
        .is('customer_id', null)
        .not('status', 'in', '("cancelled","completed")')
        .order('starts_at', { ascending: true }),
    ])
    setDayAppointments(day || [])
    setUnmatched(pending || [])
    setLoading(false)
  }, [dateStr])

  useEffect(() => { fetchSchedule() }, [fetchSchedule])

  const complete = useCallback(async (id, style) => {
    if (MOCK_MODE) {
      setDayAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'completed' } : a))
      return { data: { xp_earned: 150 }, error: null }
    }
    const { data, error } = await supabase.rpc('complete_appointment', {
      p_appointment_id: id,
      p_style: style || null,
    })
    if (!error) await fetchSchedule()
    return { data, error }
  }, [fetchSchedule])

  const markNoShow = useCallback(async (id) => {
    if (MOCK_MODE) {
      setDayAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'no_show' } : a))
      return { error: null }
    }
    const { error } = await supabase.from('appointments').update({ status: 'no_show' }).eq('id', id)
    if (!error) await fetchSchedule()
    return { error }
  }, [fetchSchedule])

  const link = useCallback(async (id, customerId) => {
    if (MOCK_MODE) {
      setUnmatched((prev) => prev.filter((a) => a.id !== id))
      return { error: null }
    }
    const { error } = await supabase.rpc('link_appointment', {
      p_appointment_id: id,
      p_customer_id: customerId,
    })
    if (!error) await fetchSchedule()
    return { error }
  }, [fetchSchedule])

  return { dayAppointments, unmatched, loading, refetch: fetchSchedule, complete, markNoShow, link }
}
