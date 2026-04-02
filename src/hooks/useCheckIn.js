import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useCheckIn() {
  const { user, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [error, setError] = useState(null)

  const checkIn = useCallback(async () => {
    if (!user?.id || loading) return { error: new Error('Not ready') }
    setLoading(true)
    setError(null)

    // Optimistic update
    setCheckedInToday(true)

    const { data, error: err } = await supabase.rpc('daily_check_in', {
      p_customer_id: user.id,
    })

    if (err || (data && data.success === false)) {
      // Roll back optimistic update on real errors only
      if (err) {
        setCheckedInToday(false)
        setError(err)
      }
      setLoading(false)
      return { data, error: err }
    }

    await refreshProfile()
    setLoading(false)
    return { data, error: null }
  }, [user?.id, loading, refreshProfile])

  const checkIfCheckedInToday = useCallback(async () => {
    if (!user?.id) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('check_ins')
      .select('id')
      .eq('customer_id', user.id)
      .gte('created_at', today)
      .limit(1)
    setCheckedInToday((data || []).length > 0)
  }, [user?.id])

  return { checkIn, loading, checkedInToday, setCheckedInToday, error, checkIfCheckedInToday }
}
