import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useSeasonPass() {
  const { user } = useAuth()
  const [seasonPass, setSeasonPass] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
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
