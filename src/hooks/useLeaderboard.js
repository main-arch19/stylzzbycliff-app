import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_LEADERBOARD, MOCK_LEADERBOARD_RANK } from '@/lib/mockData'

export function useLeaderboard(limit = 20) {
  const { user } = useAuth()
  const [board, setBoard] = useState(MOCK_MODE ? MOCK_LEADERBOARD : [])
  const [myRank, setMyRank] = useState(MOCK_MODE ? MOCK_LEADERBOARD_RANK : null)
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchLeaderboard = useCallback(async () => {
    if (MOCK_MODE) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_leaderboard', { p_limit: limit })
    if (err) { setError(err) }
    else {
      setBoard(data || [])
      const myEntry = data?.find((r) => r.id === user?.id)
      setMyRank(myEntry?.rank ?? null)
    }
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  // Realtime: re-fetch when any profile XP changes
  useEffect(() => {
    if (MOCK_MODE) return
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => { fetchLeaderboard() }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchLeaderboard])

  return { board, myRank, loading, error, refetch: fetchLeaderboard }
}
