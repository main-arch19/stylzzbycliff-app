import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRewards } from '@/hooks/useRewards'
import { useChallenges } from '@/hooks/useChallenges'
import { useSeasonPass } from '@/hooks/useSeasonPass'
import { BadgeGrid } from '@/components/BadgeGrid'
import { RewardCard } from '@/components/RewardCard'
import { SeasonPass } from '@/components/SeasonPass'
import { ChallengeCard } from '@/components/ChallengeCard'
import { useToast } from '@/components/Toast'
import ThemeToggle from '@/components/ThemeToggle'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

export default function Rewards() {
  const { profile } = useAuth()
  const { rewards, claimedRewards, loading, claimReward, isRewardClaimed, isRewardRedeemed } = useRewards()
  const { challenges, getProgress } = useChallenges()
  const toast = useToast()
  const [claimingId, setClaimingId] = useState(null)
  const [badges, setBadges] = useState([])
  const [earnedBadges, setEarnedBadges] = useState([])

  useEffect(() => {
    supabase.from('badges').select('*').eq('is_active', true).then(({ data }) => setBadges(data || []))
    if (profile?.id) {
      supabase.from('earned_badges').select('*').eq('customer_id', profile.id).then(({ data }) => setEarnedBadges(data || []))
    }
  }, [profile?.id])

  const handleClaim = async (rewardId) => {
    setClaimingId(rewardId)
    const { data, error } = await claimReward(rewardId)
    if (error) {
      toast('Something went wrong, King. Try again.', 'error')
    } else if (data?.success === false) {
      toast(data.message || 'Cannot claim this reward yet.', 'error')
    } else {
      toast("Reward claimed! Show this to your barber.", 'success')
    }
    setClaimingId(null)
  }

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-midnight sticky top-0 z-10 border-b border-line/5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">REWARDS</h1>
          <p className="font-body text-[10px] text-warm-grey">Keep earning. Keep claiming. Stay fresh.</p>
        </div>
        <ThemeToggle className="mt-1" />
      </div>

      <div className="px-4 space-y-6 pt-4">
        {/* Milestone Rewards */}
        <section>
          <div className="section-header mb-3">MILESTONE REWARDS</div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="card h-28 bg-charcoal animate-skeleton" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  totalCuts={profile?.total_cuts || 0}
                  isClaimed={isRewardClaimed(reward.id)}
                  isRedeemed={isRewardRedeemed(reward.id)}
                  onClaim={handleClaim}
                  claiming={claimingId === reward.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Badges */}
        <section>
          <div className="section-header mb-3">BADGE COLLECTION</div>
          <BadgeGrid
            badges={badges}
            earnedBadges={earnedBadges}
            totalCuts={profile?.total_cuts || 0}
            currentStreak={profile?.current_streak || 0}
          />
        </section>

        {/* Season Pass */}
        <section>
          <div className="section-header mb-3">SEASON PASS</div>
          <SeasonPass />
        </section>

        {/* Completed Challenges */}
        {challenges.some((c) => getProgress(c.id)?.completed) && (
          <section>
            <div className="section-header mb-3">COMPLETED CHALLENGES</div>
            <div className="space-y-3">
              {challenges
                .filter((c) => getProgress(c.id)?.completed)
                .map((c) => (
                  <ChallengeCard key={c.id} challenge={c} progress={getProgress(c.id)} />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
