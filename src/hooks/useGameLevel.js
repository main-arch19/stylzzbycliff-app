import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getGameLevel, getGameLevelProgress, getDecayWarning } from '@/utils/helpers'

export function useGameLevel() {
  const { profile, refreshProfile } = useAuth()
  const [decayInfo, setDecayInfo] = useState(null)
  const [loading, setLoading]     = useState(true)

  const runDecay = useCallback(async (profileId) => {
    try {
      const { data } = await supabase.rpc('apply_decay', { p_customer_id: profileId })
      if (data) {
        setDecayInfo(data)
        // If decay was actually applied, refresh profile to get updated game_cuts
        if (data.decay_applied > 0) {
          await refreshProfile()
        }
      }
    } catch {
      // Non-fatal — decay info just won't show
    } finally {
      setLoading(false)
    }
  }, [refreshProfile])

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }
    // Only run decay for customers (not barbers/admins)
    if (profile.role !== 'customer') {
      setLoading(false)
      return
    }
    runDecay(profile.id)
  }, [profile?.id, profile?.role, runDecay])

  const gameCuts        = profile?.game_cuts ?? 0
  const hallOfFameCount = profile?.hall_of_fame_count ?? 0
  const level           = getGameLevel(gameCuts)
  const levelProgress   = getGameLevelProgress(gameCuts)
  const nextAt          = level.nextAt
  const cutsToNext      = nextAt ? nextAt - gameCuts : 0

  // Client-side decay warning (used as fallback / initial display before RPC resolves)
  const decayWarning = decayInfo?.in_decay_window
    ? { daysInactive: decayInfo.days_inactive, nextDecayInDays: decayInfo.next_decay_in_days }
    : getDecayWarning(profile?.last_cut_date)

  return {
    gameCuts,
    hallOfFameCount,
    level,
    levelProgress,
    nextAt,
    cutsToNext,
    decayWarning,
    loading,
  }
}
