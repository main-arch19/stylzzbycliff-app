import { Flame, Scissors, Trophy, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCuts } from '@/hooks/useCuts'
import { useChallenges } from '@/hooks/useChallenges'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useGameLevel } from '@/hooks/useGameLevel'
import { XPCard } from '@/components/XPCard'
import { CheckInButton } from '@/components/CheckInButton'
import { SpinWheel } from '@/components/SpinWheel'
import { ChallengeCard, ChallengeCardSkeleton } from '@/components/ChallengeCard'
import { CutHistoryRow, CutHistoryRowSkeleton } from '@/components/CutHistoryRow'
import { GameLevelCard } from '@/components/GameLevelCard'
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { cuts, loading: cutsLoading } = useCuts(5)
  const { challenges, loading: challengesLoading, getProgress } = useChallenges()
  const { myRank } = useLeaderboard()
  const { decayWarning } = useGameLevel()

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Morning,'
    if (hour < 17) return "What's good,"
    return 'Evening,'
  }

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 bg-midnight sticky top-0 z-10 border-b border-white/5 flex items-start justify-between gap-3">
        <div>
          <div className="font-body text-[11px] text-warm-grey">{greeting()}</div>
          <div className="font-display text-[28px] text-white uppercase tracking-wider leading-tight">
            {profile?.username || 'King'}
          </div>
        </div>
        <ThemeToggle className="mt-1" />
      </div>

      <div className="px-4 space-y-4 pt-4">
        {/* XP Card */}
        <XPCard profile={profile} loading={!profile} />

        {/* Inactivity decay warning */}
        {decayWarning && (
          <div
            className="flex items-start gap-3 p-3 rounded-[12px]"
            style={{ background: 'rgba(230,126,34,0.1)', border: '1px solid rgba(230,126,34,0.25)' }}
          >
            <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
            <div className="font-body text-[11px] text-cream">
              You haven't visited in{' '}
              <span className="text-warning font-semibold">{decayWarning.daysInactive} days</span>.
              {' '}You'll lose a cut credit in{' '}
              <span className="text-warning font-semibold">{decayWarning.nextDecayInDays} day{decayWarning.nextDecayInDays !== 1 ? 's' : ''}</span>!
            </div>
          </div>
        )}

        {/* Game Level Card */}
        <GameLevelCard />

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Scissors size={14} className="text-clipper-red" />}
            value={profile?.total_cuts ?? '—'}
            label="CUTS"
          />
          <StatCard
            icon={<Flame size={14} className="text-warning" />}
            value={profile?.current_streak ?? '—'}
            label="STREAK"
          />
          <StatCard
            icon={<Trophy size={14} className="text-accent" />}
            value={myRank ? `#${myRank}` : '—'}
            label="RANK"
          />
        </div>

        {/* Check-in */}
        <CheckInButton />

        {/* Spin Wheel */}
        <SpinWheel />

        {/* Active Challenges */}
        {(challengesLoading || challenges.length > 0) && (
          <div>
            <div className="section-header mb-3">ACTIVE CHALLENGES</div>
            <div className="space-y-3">
              {challengesLoading
                ? [1,2].map((i) => <ChallengeCardSkeleton key={i} />)
                : challenges.map((c) => (
                    <ChallengeCard key={c.id} challenge={c} progress={getProgress(c.id)} />
                  ))
              }
            </div>
          </div>
        )}

        {/* Recent Cuts */}
        <div>
          <div className="section-header mb-3">RECENT CUTS</div>
          <div className="card px-4">
            {cutsLoading
              ? [1,2,3].map((i) => <CutHistoryRowSkeleton key={i} />)
              : cuts.length === 0
              ? (
                  <div className="py-8 text-center">
                    <div className="text-2xl mb-2">✂️</div>
                    <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
                      No cuts yet, King.
                    </div>
                    <div className="font-body text-[10px] text-warm-grey mt-1">
                      Tap in and get fresh.
                    </div>
                  </div>
                )
              : cuts.map((cut) => <CutHistoryRow key={cut.id} cut={cut} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label }) {
  return (
    <div className="card p-3 flex flex-col items-center gap-1">
      {icon}
      <div className="font-display text-[22px] text-white leading-none">{value}</div>
      <div className="font-heading text-[8px] tracking-widest uppercase text-warm-grey">{label}</div>
    </div>
  )
}
