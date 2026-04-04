import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE, MOCK_REWARDS, MOCK_CLAIMED_REWARDS } from '@/lib/mockData'

export function useRewards() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState(MOCK_MODE ? MOCK_REWARDS : [])
  const [claimedRewards, setClaimedRewards] = useState(MOCK_MODE ? MOCK_CLAIMED_REWARDS : [])
  const [loading, setLoading] = useState(!MOCK_MODE)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (MOCK_MODE) return
    if (!user?.id) return
    setLoading(true)
    setError(null)

    const [rewardsRes, claimedRes] = await Promise.all([
      supabase.from('rewards').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('claimed_rewards').select('*, rewards(*)').eq('customer_id', user.id),
    ])

    if (rewardsRes.error) setError(rewardsRes.error)
    else setRewards(rewardsRes.data || [])

    if (!claimedRes.error) setClaimedRewards(claimedRes.data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const claimReward = useCallback(async (rewardId) => {
    if (!user?.id) return { error: new Error('Not authenticated') }
    const { data, error: err } = await supabase.rpc('claim_reward', {
      p_customer_id: user.id,
      p_reward_id: rewardId,
    })
    if (!err) await fetchData()
    return { data, error: err }
  }, [user?.id, fetchData])

  const isRewardClaimed = (rewardId) =>
    claimedRewards.some((cr) => cr.reward_id === rewardId)

  const isRewardRedeemed = (rewardId) =>
    claimedRewards.some((cr) => cr.reward_id === rewardId && cr.redeemed)

  return { rewards, claimedRewards, loading, error, claimReward, isRewardClaimed, isRewardRedeemed, refetch: fetchData }
}
