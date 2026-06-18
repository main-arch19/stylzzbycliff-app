import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_MODE, MOCK_DASHBOARD, MOCK_APPOINTMENTS } from '@/lib/mockData'

const ACTIVE = ['pending', 'confirmed']

function mockWebsiteBookings() {
  return MOCK_APPOINTMENTS.filter(
    (a) => a.source === 'website' && ACTIVE.includes(a.status) &&
      new Date(a.starts_at).getTime() >= Date.now(),
  ).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
}

// At-a-glance numbers (one RPC) + the upcoming website-booking list.
export function useBarberDashboard() {
  const [stats, setStats] = useState(MOCK_MODE ? MOCK_DASHBOARD : null)
  const [websiteBookings, setWebsiteBookings] = useState(MOCK_MODE ? mockWebsiteBookings() : [])
  const [loading, setLoading] = useState(!MOCK_MODE)

  const fetchAll = useCallback(async () => {
    if (MOCK_MODE) return
    setLoading(true)
    const [{ data: dash }, { data: web }] = await Promise.all([
      supabase.rpc('get_barber_dashboard'),
      supabase
        .from('appointments')
        .select('*, barbers (name)')
        .eq('source', 'website')
        .in('status', ACTIVE)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(8),
    ])
    if (dash) setStats(dash)
    setWebsiteBookings(web || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { stats, websiteBookings, loading, refetch: fetchAll }
}
