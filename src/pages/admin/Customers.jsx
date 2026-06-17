import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getTierInfo, formatRelativeDate, formatDate, getGameLevel } from '@/utils/helpers'

export default function Customers() {
  const { profile: adminProfile } = useAuth()
  const [customers, setCustomers]         = useState([])
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState(null)
  const [cuts, setCuts]                   = useState([])
  const [claimedRewards, setClaimedRewards] = useState([])
  const [earnedBadges, setEarnedBadges]   = useState([])

  // Manual game_cuts adjustment state
  const [adjustId, setAdjustId]           = useState(null)
  const [adjustValue, setAdjustValue]     = useState('')
  const [adjusting, setAdjusting]         = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'customer')
      .order('total_xp', { ascending: false })
      .then(({ data }) => { setCustomers(data || []); setLoading(false) })
  }, [])

  const loadCustomerDetail = async (customer) => {
    setSelected(customer)
    setAdjustId(null)
    const [cutsRes, rewardsRes, badgesRes] = await Promise.all([
      supabase.from('cuts').select('*, barbers(name)').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('claimed_rewards').select('*, rewards(name, icon)').eq('customer_id', customer.id),
      supabase.from('earned_badges').select('*, badges(name, icon)').eq('customer_id', customer.id),
    ])
    setCuts(cutsRes.data || [])
    setClaimedRewards(rewardsRes.data || [])
    setEarnedBadges(badgesRes.data || [])
  }

  const handleAdjust = async (customerId) => {
    const val = parseInt(adjustValue, 10)
    if (isNaN(val) || val < 0 || val > 20) {
      alert('Enter a number between 0 and 20.')
      return
    }
    setAdjusting(true)
    try {
      const { data, error } = await supabase.rpc('admin_adjust_game_cuts', {
        p_customer_id:   customerId,
        p_new_game_cuts: val,
        p_admin_id:      adminProfile.id,
      })
      if (error) throw error
      if (data?.success) {
        // Update local list
        setCustomers((prev) =>
          prev.map((c) => c.id === customerId ? { ...c, game_cuts: data.game_cuts } : c)
        )
        if (selected?.id === customerId) {
          setSelected((s) => ({ ...s, game_cuts: data.game_cuts }))
        }
        setAdjustId(null)
        setAdjustValue('')
      }
    } catch (err) {
      alert(err?.message || 'Adjustment failed.')
    } finally {
      setAdjusting(false)
    }
  }

  const filtered = search.trim()
    ? customers.filter((c) => c.username.toLowerCase().includes(search.toLowerCase()))
    : customers

  return (
    <div className="p-4">
      <h1 className="font-display text-[28px] text-cream uppercase tracking-wider mb-4">CUSTOMERS</h1>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-grey" />
        <input className="input pl-9" placeholder="Search by username..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => <div key={i} className="card h-16 animate-skeleton" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const tier      = getTierInfo(c.membership_tier)
            const gameCuts  = c.game_cuts ?? 0
            const gameLevel = getGameLevel(gameCuts)
            const isOpen    = selected?.id === c.id
            return (
              <div key={c.id} className="card overflow-hidden">
                <button
                  onClick={() => isOpen ? setSelected(null) : loadCustomerDetail(c)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-line/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-charcoal border border-line/10 flex items-center justify-center text-sm font-bold uppercase text-warm-grey shrink-0">
                    {c.username[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-[14px] font-semibold tracking-wider uppercase text-cream truncate">{c.username}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[9px] text-accent">{c.total_xp.toLocaleString()} XP</span>
                      <span className="font-mono text-[9px] text-warm-grey">·</span>
                      <span className="font-mono text-[9px] text-warm-grey">{c.total_cuts} cuts</span>
                      <span className="font-mono text-[9px] text-warm-grey">·</span>
                      <span className="font-mono text-[9px]" style={{ color: gameLevel.color }}>
                        {gameLevel.icon} {gameCuts}
                      </span>
                    </div>
                  </div>
                  <span className="font-heading text-[8px] px-2 py-0.5 rounded-pill uppercase tracking-wider shrink-0"
                    style={{ background: tier.bg, color: tier.color }}>
                    {tier.label}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-warm-grey shrink-0" /> : <ChevronDown size={14} className="text-warm-grey shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4 border-t border-line/5">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 pt-3">
                      {[
                        { label: 'XP',     value: c.total_xp.toLocaleString() },
                        { label: 'CUTS',   value: c.total_cuts },
                        { label: 'STREAK', value: c.current_streak },
                      ].map((s) => (
                        <div key={s.label} className="text-center p-2 rounded-[8px] bg-midnight">
                          <div className="font-mono text-[14px] text-cream">{s.value}</div>
                          <div className="font-heading text-[8px] uppercase tracking-wider text-warm-grey">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Game level row */}
                    <div
                      className="flex items-center justify-between p-3 rounded-[10px]"
                      style={{ background: `${gameLevel.color}10`, border: `1px solid ${gameLevel.color}25` }}
                    >
                      <div>
                        <div className="font-heading text-[11px] tracking-wider uppercase" style={{ color: gameLevel.color }}>
                          {gameLevel.icon} {gameLevel.name}
                        </div>
                        <div className="font-body text-[9px] text-warm-grey mt-0.5">
                          {gameCuts} game cuts
                          {c.hall_of_fame_count > 0 && ` · 🏆 ×${c.hall_of_fame_count}`}
                          {c.last_cut_date && ` · Last visit ${formatDate(c.last_cut_date)}`}
                        </div>
                      </div>

                      {/* Adjust button */}
                      {adjustId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={adjustValue}
                            onChange={(e) => setAdjustValue(e.target.value)}
                            className="input w-16 text-center py-1 text-[12px]"
                            placeholder="0–20"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAdjust(c.id)}
                            disabled={adjusting}
                            className="p-1.5 rounded-[6px] bg-success/15 text-success disabled:opacity-50"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => { setAdjustId(null); setAdjustValue('') }}
                            className="p-1.5 rounded-[6px] bg-line/5 text-warm-grey"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAdjustId(c.id); setAdjustValue(String(gameCuts)) }}
                          className="font-heading text-[9px] tracking-wider uppercase px-2.5 py-1.5 rounded-pill text-warm-grey hover:text-cream transition-colors"
                          style={{ background: 'rgba(var(--c-line) / 0.05)' }}
                        >
                          ADJUST
                        </button>
                      )}
                    </div>

                    {/* Cut history */}
                    <div>
                      <div className="section-header mb-2">RECENT CUTS</div>
                      {cuts.length === 0 ? (
                        <div className="font-body text-[10px] text-warm-grey">No cuts logged.</div>
                      ) : (
                        <div className="space-y-1">
                          {cuts.slice(0, 5).map((cut) => (
                            <div key={cut.id} className="flex items-center justify-between py-1.5 border-b border-line/5 last:border-0">
                              <div>
                                <span className="font-heading text-[11px] uppercase tracking-wider text-cream">{cut.style}</span>
                                {cut.barbers?.name && (
                                  <span className="font-body text-[9px] text-warm-grey ml-2">· {cut.barbers.name}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-accent">+{cut.xp_earned}</span>
                                <span className="font-body text-[9px] text-warm-grey">{formatRelativeDate(cut.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rewards & Badges */}
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="section-header mb-1.5">REWARDS</div>
                        <div className="font-body text-[10px] text-warm-grey">
                          {claimedRewards.length === 0 ? 'None claimed' : claimedRewards.map((r) => `${r.rewards?.icon} ${r.rewards?.name}`).join(', ')}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="section-header mb-1.5">BADGES</div>
                        <div className="font-body text-[10px] text-warm-grey">
                          {earnedBadges.length === 0 ? 'None earned' : earnedBadges.map((b) => `${b.badges?.icon}`).join(' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
