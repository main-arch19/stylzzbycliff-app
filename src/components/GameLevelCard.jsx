import { useNavigate } from 'react-router-dom'
import { useGameLevel } from '@/hooks/useGameLevel'
import { GAME_HOF_AT } from '@/utils/constants'

export function GameLevelCard({ onHallOfFame }) {
  const navigate = useNavigate()
  const {
    gameCuts,
    hallOfFameCount,
    level,
    levelProgress,
    nextAt,
    cutsToNext,
    loading,
  } = useGameLevel()

  if (loading) {
    return <div className="card h-[120px] animate-skeleton" />
  }

  const isUnranked   = level.id === 'unranked' && hallOfFameCount === 0
  const isFirstEntry = level.id === 'unranked'

  return (
    <div
      className="card p-4"
      style={{ borderColor: `${level.color}30` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{level.icon}</span>
          <div>
            <div
              className="font-display text-[15px] uppercase tracking-widest leading-none"
              style={{ color: level.color }}
            >
              {isFirstEntry && hallOfFameCount === 0 ? 'UNRANKED' : level.name.toUpperCase()}
            </div>
            <div className="font-heading text-[8px] tracking-wider uppercase text-warm-grey mt-0.5">
              GAME LEVEL
            </div>
          </div>
        </div>

        {/* Hall of Fame counter */}
        {hallOfFameCount > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-pill"
            style={{ background: 'rgba(160,200,255,0.1)', border: '1px solid rgba(160,200,255,0.2)' }}
          >
            <span className="text-[12px]">🏆</span>
            <span className="font-display text-[12px]" style={{ color: '#A0C8FF' }}>
              ×{hallOfFameCount}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-2">
        <div
          className="progress-fill transition-all duration-700"
          style={{
            width: `${levelProgress}%`,
            background: level.color,
          }}
        />
      </div>

      {/* Progress label */}
      <div className="flex items-center justify-between">
        <div className="font-body text-[10px] text-warm-grey">
          {isFirstEntry && hallOfFameCount === 0
            ? `${gameCuts}/5 cuts — Get 5 cuts to enter the game.`
            : nextAt
            ? `${gameCuts} cuts · ${cutsToNext} to ${cutsToNext === 1 && nextAt === GAME_HOF_AT ? 'Hall of Fame' : 'Level Up'}`
            : `${gameCuts} cuts`
          }
        </div>
        <button
          onClick={() => navigate('/submit-cut')}
          className="font-heading text-[9px] tracking-wider uppercase px-3 py-1.5 rounded-pill transition-all"
          style={{
            background: 'rgba(192,57,43,0.15)',
            color: '#C0392B',
            border: '1px solid rgba(192,57,43,0.25)',
          }}
        >
          SUBMIT CUT
        </button>
      </div>
    </div>
  )
}
