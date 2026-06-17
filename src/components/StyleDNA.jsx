import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { HAIRCUT_STYLES, BEARD_STYLES } from '@/utils/constants'
import { MOCK_MODE, MOCK_STYLE_DNA } from '@/lib/mockData'

export function StyleDNA() {
  return (
    <div className="space-y-3">
      <StyleDNAPicker />
      <StyleBreakdown />
    </div>
  )
}

// ─── Pill selector ──────────────────────────────────────────────────
function Chip({ label, active, accent, onClick }) {
  const activeCls = accent
    ? 'border-gold-blade bg-gold-blade/15 text-gold-blade'
    : 'border-clipper-red bg-clipper-red/15 text-clipper-red'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-pill border font-heading text-[10px] tracking-wider uppercase transition-all ${
        active ? activeCls : 'border-line/10 text-warm-grey hover:border-line/30'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Picker: build your signature haircut + beard combo ─────────────
function StyleDNAPicker() {
  const { profile, updateProfile } = useAuth()
  const toast = useToast()
  const [haircut, setHaircut] = useState('')
  const [beard, setBeard] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync local selection with the saved profile (also covers late profile load)
  useEffect(() => {
    setHaircut(profile?.style_dna_haircut || '')
    setBeard(profile?.style_dna_beard || '')
  }, [profile?.style_dna_haircut, profile?.style_dna_beard])

  const savedHaircut = profile?.style_dna_haircut || ''
  const savedBeard = profile?.style_dna_beard || ''
  const dirty = haircut !== savedHaircut || beard !== savedBeard
  const hasSelection = Boolean(haircut || beard)

  // Tap an active chip again to clear it (combination is optional)
  const toggle = (current, value, setter) => setter(current === value ? '' : value)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateProfile({
      style_dna_haircut: haircut || null,
      style_dna_beard: beard || null,
    })
    if (error) toast('Could not save your Style DNA.', 'error')
    else toast('Style DNA locked in.', 'success')
    setSaving(false)
  }

  return (
    <div className="card p-5">
      {/* Signature hero — the combination IS your DNA */}
      <div className="font-heading text-[9px] tracking-widest uppercase text-warm-grey mb-2">
        Your Signature
      </div>
      <div className="p-4 rounded-[10px] border border-clipper-red/30 bg-gradient-to-br from-clipper-red/10 to-transparent mb-5">
        {hasSelection ? (
          <div className="flex items-center justify-center gap-3 flex-wrap text-center">
            <span className="font-display text-[22px] text-cream uppercase tracking-wide leading-none">
              {haircut || '—'}
            </span>
            <span className="font-display text-[18px] text-clipper-red leading-none">×</span>
            <span className="font-display text-[22px] text-cream uppercase tracking-wide leading-none">
              {beard || '—'}
            </span>
          </div>
        ) : (
          <div className="text-center font-body text-[11px] text-warm-grey py-2">
            Pick a haircut and a beard to define your signature look.
          </div>
        )}
      </div>

      {/* Haircut picker */}
      <div className="mb-4">
        <div className="section-header mb-2.5">Haircut</div>
        <div className="flex flex-wrap gap-2">
          {HAIRCUT_STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={haircut === s}
              onClick={() => toggle(haircut, s, setHaircut)}
            />
          ))}
        </div>
      </div>

      {/* Beard picker */}
      <div className="mb-5">
        <div className="section-header mb-2.5">Beard</div>
        <div className="flex flex-wrap gap-2">
          {BEARD_STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              accent
              active={beard === s}
              onClick={() => toggle(beard, s, setBeard)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="btn btn-primary w-full"
      >
        {saving ? 'SAVING...' : 'SAVE STYLE DNA'}
      </button>
    </div>
  )
}

// ─── Breakdown: percentage analytics of past cuts (secondary) ───────
function StyleBreakdown() {
  const { user } = useAuth()
  const [data, setData] = useState(MOCK_MODE ? MOCK_STYLE_DNA : null)
  const [loading, setLoading] = useState(!MOCK_MODE)

  useEffect(() => {
    if (MOCK_MODE) return
    if (!user?.id) return
    let active = true
    supabase.rpc('get_style_dna', { p_customer_id: user.id })
      .then(({ data: d }) => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id])

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="h-4 w-32 bg-charcoal animate-skeleton rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-24 bg-charcoal animate-skeleton rounded" />
            <div className="h-1.5 w-full bg-charcoal animate-skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  // No cut history yet — hide the secondary breakdown entirely
  if (!data || data.total === 0) return null

  const styles = data.styles || []
  const topStyle = styles[0]

  const insightText = () => {
    if (!topStyle) return 'Keep getting cuts to build your Style DNA.'
    const pct = topStyle.percentage
    if (pct >= 70) return `You're a loyal ${topStyle.style} king. Why fix what ain't broke?`
    if (pct >= 40) return `${topStyle.style} is your go-to, but you like to mix it up. Respect.`
    return `${data.unique_styles} different styles? You're a style shifter, King.`
  }

  return (
    <div className="card p-5">
      <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream mb-1">
        Style Breakdown
      </div>
      <div className="font-body text-[10px] text-warm-grey mb-4">
        {data.total} total cuts · {data.unique_styles} styles tried
        {data.favorite_barber ? ` · Fav barber: ${data.favorite_barber}` : ''}
      </div>

      {/* Style bars */}
      <div className="space-y-3 mb-4">
        {styles.map((s) => (
          <div key={s.style}>
            <div className="flex justify-between mb-1">
              <span className="font-heading text-[11px] font-medium tracking-wide uppercase text-cream">{s.style}</span>
              <span className="font-mono text-[10px] text-warm-grey">{s.percentage}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${s.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* AI insight card */}
      <div className="p-3 rounded-[8px] border border-clipper-red/30 bg-clipper-red/5">
        <div className="font-heading text-[9px] tracking-widest uppercase text-clipper-red mb-1">STYLE READ</div>
        <div className="font-body text-[10px] text-text-primary">{insightText()}</div>
      </div>
    </div>
  )
}
