import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function StyleDNA() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase.rpc('get_style_dna', { p_customer_id: user.id })
      .then(({ data: d }) => { setData(d); setLoading(false) })
  }, [user?.id])

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="h-4 w-32 bg-charcoal animate-skeleton rounded" />
        {[1,2,3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-24 bg-charcoal animate-skeleton rounded" />
            <div className="h-1.5 w-full bg-charcoal animate-skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="card p-5 text-center">
        <div className="text-2xl mb-2">✂️</div>
        <div className="font-heading text-[12px] tracking-wider uppercase text-warm-grey">
          No Style DNA Yet
        </div>
        <div className="font-body text-[10px] text-warm-grey mt-1">
          Get your first cut to see your style breakdown.
        </div>
      </div>
    )
  }

  const styles = data.styles || []
  const topStyle = styles[0]

  const insightText = () => {
    if (!topStyle) return "Keep getting cuts to build your Style DNA."
    const pct = topStyle.percentage
    if (pct >= 70) return `You're a loyal ${topStyle.style} king. Why fix what ain't broke?`
    if (pct >= 40) return `${topStyle.style} is your go-to, but you like to mix it up. Respect.`
    return `${data.unique_styles} different styles? You're a style shifter, King.`
  }

  return (
    <div className="card p-5">
      <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white mb-1">
        STYLE DNA
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
              <span className="font-heading text-[11px] font-medium tracking-wide uppercase text-white">{s.style}</span>
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
