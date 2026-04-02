import { useState } from 'react'
import { Search, CheckCircle, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatRelativeDate } from '@/utils/helpers'

export default function RedeemReward() {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [claimedRewards, setClaimedRewards] = useState([])
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState(null)
  const toast = useToast()

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, total_cuts, membership_tier')
      .ilike('username', `%${search.trim()}%`)
      .eq('role', 'customer')
      .limit(5)
    setCustomers(data || [])
    setLoading(false)
  }

  const handleSelectCustomer = async (customer) => {
    setSelected(customer)
    setCustomers([])
    const { data } = await supabase
      .from('claimed_rewards')
      .select('*, rewards(name, icon, description)')
      .eq('customer_id', customer.id)
      .eq('redeemed', false)
      .order('claimed_at', { ascending: false })
    setClaimedRewards(data || [])
  }

  const handleRedeem = async (claimedId) => {
    setRedeeming(claimedId)
    const { error } = await supabase
      .from('claimed_rewards')
      .update({ redeemed: true, redeemed_at: new Date().toISOString() })
      .eq('id', claimedId)
    if (error) {
      toast('Could not redeem. Try again.', 'error')
    } else {
      toast('Reward redeemed! Enjoy, King.', 'success')
      setClaimedRewards((prev) => prev.filter((r) => r.id !== claimedId))
    }
    setRedeeming(null)
  }

  return (
    <div className="p-4 max-w-xl">
      <h1 className="font-display text-[28px] text-white uppercase tracking-wider mb-2">REDEEM REWARDS</h1>
      <p className="font-body text-[10px] text-warm-grey mb-5">Customer presents their claimed reward. Mark it as redeemed.</p>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-grey" />
          <input
            className="input pl-9"
            placeholder="Search customer username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button onClick={handleSearch} disabled={loading} className="btn btn-primary px-5" style={{ height: 48, minWidth: 0 }}>
          {loading ? '...' : 'FIND'}
        </button>
      </div>

      {/* Search results */}
      {customers.length > 0 && (
        <div className="card p-2 mb-4 space-y-1">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectCustomer(c)}
              className="w-full flex items-center gap-3 p-3 rounded-[8px] hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center text-xs font-bold uppercase text-warm-grey shrink-0">
                {c.username[0]}
              </div>
              <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white">{c.username}</div>
              <div className="ml-auto font-mono text-[9px] text-warm-grey">{c.total_cuts} cuts</div>
            </button>
          ))}
        </div>
      )}

      {/* Selected customer + rewards */}
      {selected && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display text-[18px] text-white uppercase">{selected.username}</div>
              <div className="font-body text-[10px] text-warm-grey">{selected.total_cuts} cuts · {selected.membership_tier}</div>
            </div>
            <button onClick={() => { setSelected(null); setClaimedRewards([]) }} className="font-heading text-[10px] tracking-wider uppercase text-warm-grey hover:text-white transition-colors">
              CHANGE
            </button>
          </div>

          <div className="section-header mb-3">CLAIMED REWARDS (PENDING REDEMPTION)</div>

          {claimedRewards.length === 0 ? (
            <div className="card p-6 text-center">
              <Tag size={24} className="text-warm-grey mx-auto mb-2" />
              <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
                No pending rewards
              </div>
              <div className="font-body text-[10px] text-warm-grey mt-1">
                This customer hasn't claimed anything yet, or all rewards are redeemed.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {claimedRewards.map((cr) => (
                <div key={cr.id} className="card p-4 border border-accent/20 flex items-center gap-3">
                  <span className="text-2xl">{cr.rewards?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white">{cr.rewards?.name}</div>
                    <div className="font-body text-[9px] text-warm-grey">Claimed {formatRelativeDate(cr.claimed_at)}</div>
                  </div>
                  <button
                    onClick={() => handleRedeem(cr.id)}
                    disabled={redeeming === cr.id}
                    className="btn btn-premium gap-1.5 shrink-0"
                    style={{ height: 40, fontSize: 11, padding: '0 16px' }}
                  >
                    <CheckCircle size={13} />
                    {redeeming === cr.id ? '...' : 'REDEEM'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
