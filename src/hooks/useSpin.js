import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useSpin() {
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [lastPrize, setLastPrize] = useState(null)
  const [error, setError] = useState(null)
  const [optimisticSpins, setOptimisticSpins] = useState(null)

  const spin = useCallback(async () => {
    if (!user?.id || loading) return { error: new Error('Not ready') }
    const currentSpins = optimisticSpins ?? profile?.spins_available ?? 0
    if (currentSpins <= 0) return { error: new Error('No spins available') }

    setLoading(true)
    setError(null)
    // Optimistic: decrement spin count
    setOptimisticSpins(currentSpins - 1)

    const { data, error: err } = await supabase.rpc('perform_spin', {
      p_customer_id: user.id,
    })

    if (err) {
      // Roll back
      setOptimisticSpins(currentSpins)
      setError(err)
      setLoading(false)
      return { error: err }
    }

    setLastPrize(data?.prize || null)
    await refreshProfile()
    setOptimisticSpins(null) // reset optimistic once profile refreshes
    setLoading(false)
    return { data, error: null }
  }, [user?.id, loading, profile?.spins_available, optimisticSpins, refreshProfile])

  const spinsAvailable = optimisticSpins ?? profile?.spins_available ?? 0

  return { spin, loading, lastPrize, setLastPrize, error, spinsAvailable }
}
