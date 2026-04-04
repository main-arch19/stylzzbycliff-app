import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_SEASON_PASS, MOCK_SEASON_PASS_PROGRESS } from '@/lib/mockData'

export function useSeasonPass() {
  const { user } = useAuth()
  const [seasonPass, setSeasonPass] = useState(MOCK_MODE ? MOCK_SEASON_PASS : null)
  const [progress, setProgress] = useState(MOCK_MODE ? MOCK_SEASON_PASS_PROGRESS : null)
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (MOCK_MODE) return
    if (!user?.id) return
    setLoading(true)
    setError(null)

    const { data: pass, error: passErr } = await supabase
      .from('season_passes')
      .select('*')
      .eq('is_active', true)
      .gte('ends_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (passErr) { setError(passErr); setLoading(false); return }
    setSeasonPass(pass)

    if (pass) {
      const { data: prog } = await supabase
        .from('season_pass_progress')
        .select('*')
        .eq('customer_id', user.id)
        .eq('season_pass_id', pass.id)
        .maybeSingle()
      setProgress(prog || { current_tier: 0, tier_xp: 0 })
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const tierProgress = progress && seasonPass
    ? Math.min(100, Math.round((progress.tier_xp / seasonPass.xp_per_tier) * 100))
    : 0

  return { seasonPass, progress, loading, error, tierProgress, refetch: fetchData }
}
