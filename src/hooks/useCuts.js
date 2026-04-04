import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_CUTS } from '@/lib/mockData'

export function useCuts(limit = 5) {
  const { user } = useAuth()
  const [cuts, setCuts] = useState(MOCK_MODE ? MOCK_CUTS.slice(0, limit) : [])
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchCuts = useCallback(async () => {
    if (MOCK_MODE) return
    if (!user?.id) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('cuts')
      .select(`
        *,
        barbers (name, avatar_url)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (err) { setError(err) } else { setCuts(data || []) }
    setLoading(false)
  }, [user?.id, limit])

  useEffect(() => { fetchCuts() }, [fetchCuts])

  return { cuts, loading, error, refetch: fetchCuts }
}

export function useAllCuts() {
  const { user } = useAuth()
  const [cuts, setCuts] = useState(MOCK_MODE ? MOCK_CUTS : [])
  const [loading, setLoading] = useState(!MOCK_MODE)

  useEffect(() => {
    if (MOCK_MODE) return
    if (!user?.id) return
    supabase
      .from('cuts')
      .select(`*, barbers (name)`)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCuts(data || []); setLoading(false) })
  }, [user?.id])

  return { cuts, loading }
}
