import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_CHALLENGES, MOCK_CHALLENGE_PROGRESS } from '@/lib/mockData'

export function useChallenges() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState(MOCK_MODE ? MOCK_CHALLENGES : [])
  const [progress, setProgress] = useState(MOCK_MODE ? MOCK_CHALLENGE_PROGRESS : {})
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (MOCK_MODE) return
    if (!user?.id) return
    setLoading(true)
    setError(null)

    const [challengesRes, progressRes] = await Promise.all([
      supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString())
        .order('ends_at'),
      supabase
        .from('challenge_progress')
        .select('*')
        .eq('customer_id', user.id),
    ])

    if (challengesRes.error) setError(challengesRes.error)
    else setChallenges(challengesRes.data || [])

    if (!progressRes.error) {
      const progressMap = {}
      for (const p of progressRes.data || []) {
        progressMap[p.challenge_id] = p
      }
      setProgress(progressMap)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const getProgress = (challengeId) => progress[challengeId] || { current_value: 0, completed: false }

  return { challenges, progress, loading, error, getProgress, refetch: fetchData }
}
