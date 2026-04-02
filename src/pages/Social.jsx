import { useLeaderboard } from '@/hooks/useLeaderboard'
import { LeaderboardRow } from '@/components/LeaderboardRow'
import { CrewCard } from '@/components/CrewCard'
import { ReferralCard } from '@/components/ReferralCard'
import { SkeletonRow } from '@/components/SkeletonLoader'
import { useAuth } from '@/hooks/useAuth'

export default function Social() {
  const { board, myRank, loading } = useLeaderboard(20)
  const { profile } = useAuth()

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-midnight sticky top-0 z-10 border-b border-white/5">
        <h1 className="font-display text-[28px] text-white uppercase tracking-wider">SOCIAL</h1>
        <p className="font-body text-[10px] text-warm-grey">Compete, connect, refer. Stay in the game.</p>
      </div>

      <div className="px-4 space-y-6 pt-4">
        {/* Leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="section-header">LEADERBOARD</div>
            {myRank && (
              <span className="font-mono text-[10px] text-accent">
                YOU: #{myRank}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {loading
              ? [1,2,3,4,5].map((i) => (
                  <div key={i} className="card">
                    <SkeletonRow />
                  </div>
                ))
              : board.length === 0
              ? (
                  <div className="card p-8 text-center">
                    <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
                      No players yet
                    </div>
                  </div>
                )
              : board.map((entry, i) => (
                  <LeaderboardRow key={entry.id} entry={entry} index={i} />
                ))
            }
          </div>

          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-body text-[8px] text-warm-grey uppercase tracking-wider">Live</span>
          </div>
        </section>

        {/* Crew */}
        <section>
          <div className="section-header mb-3">YOUR CREW</div>
          <CrewCard />
        </section>

        {/* Referral */}
        <section>
          <div className="section-header mb-3">REFERRAL PROGRAM</div>
          <ReferralCard referralCode={profile?.referral_code} />
        </section>
      </div>
    </div>
  )
}
