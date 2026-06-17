import { useState, useEffect } from 'react'
import { Users, Scissors, TrendingUp, Star, AlertTriangle, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GAME_LEVELS, DECAY_WARNING_THRESHOLD } from '@/utils/constants'
import { getGameLevel } from '@/utils/helpers'

export default function Analytics() {
  const [stats, setStats]               = useState(null)
  const [topCustomers, setTopCustomers] = useState([])
  const [popularStyles, setPopularStyles] = useState([])
  const [levelStats, setLevelStats]     = useState([])
  const [decayRiskCount, setDecayRiskCount] = useState(0)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const now      = new Date()
      const weekAgo  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
      const decayThresholdDate = new Date(now - DECAY_WARNING_THRESHOLD * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]

      const [
        { count: totalCustomers },
        { count: cutsThisWeek },
        { count: cutsThisMonth },
        { data: topCusts },
        { data: styles },
        { data: gameData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('cuts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('cuts').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
        supabase.from('profiles')
          .select('username, total_cuts, total_xp, membership_tier')
          .eq('role', 'customer')
          .order('total_cuts', { ascending: false })
          .limit(5),
        supabase.from('cuts').select('style'),
        // Fetch game_cuts + last_cut_date for all customers to compute level/decay stats
        supabase.from('profiles')
          .select('game_cuts, hall_of_fame_count, last_cut_date')
          .eq('role', 'customer'),
      ])

      setStats({ totalCustomers, cutsThisWeek, cutsThisMonth })
      setTopCustomers(topCusts || [])

      // Aggregate styles
      const styleCounts = {}
      for (const cut of styles || []) {
        styleCounts[cut.style] = (styleCounts[cut.style] || 0) + 1
      }
      const total = styles?.length || 1
      const sorted = Object.entries(styleCounts)
        .sort(([,a],[,b]) => b - a)
        .slice(0, 8)
        .map(([style, count]) => ({ style, count, pct: Math.round((count / total) * 100) }))
      setPopularStyles(sorted)

      // Game level distribution
      const levelCounts = {}
      GAME_LEVELS.forEach((l) => { levelCounts[l.id] = 0 })
      let decayRisk = 0
      const thresholdMs = DECAY_WARNING_THRESHOLD * 24 * 60 * 60 * 1000

      for (const row of gameData || []) {
        const lvl = getGameLevel(row.game_cuts ?? 0)
        levelCounts[lvl.id] = (levelCounts[lvl.id] || 0) + 1

        if (row.last_cut_date && (row.game_cuts ?? 0) > 0) {
          const daysSince = (Date.now() - new Date(row.last_cut_date).getTime()) / (24 * 60 * 60 * 1000)
          if (daysSince >= DECAY_WARNING_THRESHOLD) decayRisk++
        }
      }

      setLevelStats(
        GAME_LEVELS.map((l) => ({ ...l, count: levelCounts[l.id] || 0 }))
      )
      setDecayRiskCount(decayRisk)

      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-40 bg-charcoal animate-skeleton rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="card h-20 animate-skeleton" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="font-display text-[28px] text-cream uppercase tracking-wider mb-5">ANALYTICS</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: <Users size={16} className="text-clipper-red" />,  value: stats?.totalCustomers ?? 0, label: 'TOTAL CUSTOMERS' },
          { icon: <Scissors size={16} className="text-accent" />,    value: stats?.cutsThisWeek ?? 0,   label: 'CUTS THIS WEEK'  },
          { icon: <TrendingUp size={16} className="text-success" />, value: stats?.cutsThisMonth ?? 0,  label: 'CUTS THIS MONTH' },
          { icon: <Star size={16} className="text-warning" />,       value: topCustomers[0]?.total_cuts ?? 0, label: 'TOP CUST. CUTS' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-midnight flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <div className="font-display text-[24px] text-cream leading-none">{s.value}</div>
              <div className="font-heading text-[8px] tracking-widest uppercase text-warm-grey mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Game Levels distribution */}
      <div className="mb-6">
        <div className="section-header mb-3">GAME LEVELS</div>
        <div className="card p-4 space-y-3">
          {levelStats.map((l) => {
            const total = levelStats.reduce((sum, x) => sum + x.count, 0) || 1
            const pct   = Math.round((l.count / total) * 100)
            return (
              <div key={l.id}>
                <div className="flex justify-between mb-1">
                  <span className="font-heading text-[11px] font-medium tracking-wider uppercase" style={{ color: l.color }}>
                    {l.icon} {l.name}
                  </span>
                  <span className="font-mono text-[10px] text-warm-grey">{l.count} ({pct}%)</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, background: l.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Decay risk alert */}
      {decayRiskCount > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-[12px] mb-6"
          style={{ background: 'rgba(230,126,34,0.1)', border: '1px solid rgba(230,126,34,0.25)' }}
        >
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <div>
            <div className="font-heading text-[12px] tracking-wider uppercase text-warning">
              {decayRiskCount} customer{decayRiskCount !== 1 ? 's' : ''} at decay risk
            </div>
            <div className="font-body text-[10px] text-warm-grey mt-0.5">
              Inactive for {DECAY_WARNING_THRESHOLD}+ days with game cuts remaining.
            </div>
          </div>
        </div>
      )}

      {/* Popular styles */}
      <div className="mb-6">
        <div className="section-header mb-3">POPULAR STYLES</div>
        <div className="card p-4 space-y-3">
          {popularStyles.length === 0 ? (
            <div className="font-body text-[10px] text-warm-grey">No cuts logged yet.</div>
          ) : popularStyles.map((s) => (
            <div key={s.style}>
              <div className="flex justify-between mb-1">
                <span className="font-heading text-[11px] font-medium tracking-wider uppercase text-cream">{s.style}</span>
                <span className="font-mono text-[10px] text-warm-grey">{s.count} ({s.pct}%)</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top customers */}
      <div>
        <div className="section-header mb-3">TOP CUSTOMERS</div>
        <div className="card divide-y divide-line/5">
          {topCustomers.map((c, i) => (
            <div key={c.username} className="flex items-center gap-3 p-3">
              <span className="font-mono text-[11px] text-warm-grey w-5">{i + 1}</span>
              <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center text-xs font-bold uppercase text-warm-grey shrink-0">
                {c.username[0]}
              </div>
              <div className="flex-1">
                <div className="font-heading text-[12px] font-semibold tracking-wider uppercase text-cream">{c.username}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] text-accent">{c.total_cuts} cuts</div>
                <div className="font-mono text-[9px] text-warm-grey">{c.total_xp.toLocaleString()} XP</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
