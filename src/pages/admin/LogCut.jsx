import { useState, useEffect, useRef } from 'react'
import { Search, CheckCircle, Scissors } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { HAIRCUT_STYLES } from '@/utils/constants'
import { getCutLoggedMessage, getErrorMessage } from '@/utils/helpers'

export default function LogCut() {
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [barbers, setBarbers] = useState([])
  const [selected, setSelected] = useState(null)
  const [barberSelected, setBarberSelected] = useState(null)
  const [style, setStyle] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const searchRef = useRef(null)

  // Load recent customers + barbers
  useEffect(() => {
    const loadData = async () => {
      const [{ data: cust }, { data: barbs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, total_cuts, membership_tier, avatar_url')
          .eq('role', 'customer')
          .order('total_cuts', { ascending: false })
          .limit(10),
        supabase
          .from('barbers')
          .select('*')
          .eq('is_active', true),
      ])
      setCustomers(cust || [])
      setBarbers(barbs || [])
      if (barbs?.length === 1) setBarberSelected(barbs[0])
    }
    loadData()
  }, [])

  // Search customers
  const filteredCustomers = search.trim()
    ? customers.filter((c) =>
        c.username.toLowerCase().includes(search.toLowerCase()) ||
        c.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : customers

  const handleLogCut = async () => {
    if (!selected || !barberSelected || !style.trim()) {
      toast('Pick a customer, barber, and style first.', 'error')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('log_cut', {
      p_customer_id: selected.id,
      p_barber_id: barberSelected.id,
      p_style: style.trim(),
    })
    if (error) {
      toast(getErrorMessage(), 'error')
    } else {
      const xp = data?.xp_earned || 150
      toast(getCutLoggedMessage(selected.username, xp), 'success')
      setSuccess({ username: selected.username, xp, streak: data?.streak, newBadges: data?.new_badges })
      // Reset form
      setSelected(null)
      setStyle('')
      setSearch('')
    }
    setLoading(false)
  }

  const handleReset = () => {
    setSuccess(null)
    searchRef.current?.focus()
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">LOG CUT</h1>
        <p className="font-body text-[10px] text-warm-grey mt-1">Under 5 seconds. Tap, confirm, done.</p>
      </div>

      {/* Success state */}
      {success && (
        <div className="card p-6 border border-success/30 text-center mb-6 animate-slide-up">
          <CheckCircle size={40} className="text-success mx-auto mb-3" />
          <div className="font-display text-[22px] text-cream uppercase mb-1">CUT LOGGED 🔥</div>
          <div className="font-heading text-[12px] tracking-wider text-warm-grey mb-2">
            {success.username} earned <span className="text-accent font-mono">+{success.xp} XP</span>
          </div>
          {success.streak > 1 && (
            <div className="font-mono text-[10px] text-warning mb-2">
              🔥 {success.streak}-visit streak
            </div>
          )}
          {success.newBadges?.length > 0 && (
            <div className="text-[11px] text-accent mb-2">
              New badge{success.newBadges.length > 1 ? 's' : ''}: {success.newBadges.map((b) => b.name).join(', ')}
            </div>
          )}
          <button onClick={handleReset} className="btn btn-primary mt-2">
            LOG ANOTHER CUT
          </button>
        </div>
      )}

      {!success && (
        <div className="space-y-5">
          {/* Step 1: Customer */}
          <div>
            <div className="section-header mb-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-clipper-red flex items-center justify-center text-[9px] text-white font-bold">1</span>
                SELECT CUSTOMER
              </span>
            </div>

            {selected ? (
              <button
                onClick={() => setSelected(null)}
                className="w-full flex items-center gap-3 p-4 rounded-[12px] border border-success/40 bg-success/5 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-sm font-bold uppercase text-success shrink-0">
                  {selected.username[0]}
                </div>
                <div className="flex-1">
                  <div className="font-heading text-[14px] font-semibold tracking-wider uppercase text-cream">
                    {selected.username}
                  </div>
                  <div className="font-mono text-[10px] text-warm-grey">{selected.total_cuts} cuts total</div>
                </div>
                <span className="font-heading text-[9px] tracking-wider text-warm-grey uppercase">CHANGE</span>
              </button>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-grey" />
                  <input
                    ref={searchRef}
                    className="input pl-9"
                    placeholder="Search customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="w-full flex items-center gap-3 p-3 rounded-[8px] border border-line/5 bg-charcoal hover:border-clipper-red/40 hover:bg-clipper-red/5 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-charcoal border border-line/10 flex items-center justify-center text-sm font-bold uppercase text-warm-grey shrink-0">
                        {c.username[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream truncate">
                          {c.username}
                        </div>
                        <div className="font-mono text-[9px] text-warm-grey">{c.total_cuts} cuts</div>
                      </div>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-4 font-body text-[10px] text-warm-grey">
                      No customers found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Step 2: Barber */}
          {barbers.length > 1 && (
            <div>
              <div className="section-header mb-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-clipper-red flex items-center justify-center text-[9px] text-white font-bold">2</span>
                  SELECT BARBER
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBarberSelected(b)}
                    className={`px-4 py-2 rounded-pill border font-heading text-[11px] tracking-wider uppercase transition-all ${
                      barberSelected?.id === b.id
                        ? 'border-clipper-red bg-clipper-red/15 text-clipper-red'
                        : 'border-line/10 text-warm-grey hover:border-line/30'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Style */}
          <div>
            <div className="section-header mb-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-clipper-red flex items-center justify-center text-[9px] text-white font-bold">
                  {barbers.length > 1 ? '3' : '2'}
                </span>
                SELECT STYLE
              </span>
            </div>
            {/* Quick style buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {HAIRCUT_STYLES.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-3 py-1.5 rounded-pill border font-heading text-[10px] tracking-wider uppercase transition-all ${
                    style === s
                      ? 'border-clipper-red bg-clipper-red/15 text-clipper-red'
                      : 'border-line/10 text-warm-grey hover:border-line/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Or type custom style..."
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleLogCut}
            disabled={loading || !selected || !barberSelected || !style}
            className="btn btn-primary w-full gap-2"
          >
            <Scissors size={16} />
            {loading ? 'LOGGING...' : 'LOG CUT'}
          </button>
        </div>
      )}
    </div>
  )
}
