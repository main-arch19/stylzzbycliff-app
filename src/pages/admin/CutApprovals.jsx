import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Image, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { HallOfFameModal } from '@/components/HallOfFameModal'
import { formatDate, formatRelativeDate } from '@/utils/helpers'
import { getGameLevel } from '@/utils/helpers'

export default function CutApprovals() {
  const { profile } = useAuth()
  const [submissions, setSubmissions]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [processing, setProcessing]       = useState({})    // { [id]: true }
  const [rejectId, setRejectId]           = useState(null)  // submission id being rejected
  const [rejectReason, setRejectReason]   = useState('')
  const [expandedPhoto, setExpandedPhoto] = useState(null)
  const [hofModal, setHofModal]           = useState(null)  // { count }

  const fetchPending = useCallback(async () => {
    const { data } = await supabase
      .from('cut_submissions')
      .select('*, profiles!customer_id(username, full_name, game_cuts, hall_of_fame_count)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setSubmissions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const handleApprove = async (sub) => {
    if (!profile?.id) return
    setProcessing((p) => ({ ...p, [sub.id]: true }))
    try {
      const { data, error } = await supabase.rpc('approve_cut_submission', {
        p_submission_id: sub.id,
        p_admin_id:      profile.id,
      })
      if (error) throw error
      if (data?.hall_of_fame) {
        setHofModal({ count: data.hall_of_fame_count })
      }
      // Remove from list
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id))
    } catch (err) {
      alert(err?.message || 'Approval failed.')
    } finally {
      setProcessing((p) => { const n = { ...p }; delete n[sub.id]; return n })
    }
  }

  const openReject = (id) => {
    setRejectId(id)
    setRejectReason('')
  }

  const handleReject = async () => {
    if (!rejectId || !profile?.id) return
    setProcessing((p) => ({ ...p, [rejectId]: true }))
    try {
      const { error } = await supabase.rpc('reject_cut_submission', {
        p_submission_id: rejectId,
        p_admin_id:      profile.id,
        p_reason:        rejectReason.trim() || null,
      })
      if (error) throw error
      setSubmissions((prev) => prev.filter((s) => s.id !== rejectId))
      setRejectId(null)
    } catch (err) {
      alert(err?.message || 'Rejection failed.')
    } finally {
      setProcessing((p) => { const n = { ...p }; delete n[rejectId]; return n })
    }
  }

  return (
    <div className="p-4 max-w-2xl">
      {hofModal && (
        <HallOfFameModal
          hofCount={hofModal.count}
          onClose={() => setHofModal(null)}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">APPROVALS</h1>
        {!loading && (
          <span
            className="font-heading text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-pill"
            style={{
              background: submissions.length > 0 ? 'rgba(192,57,43,0.15)' : 'rgba(var(--c-line) / 0.05)',
              color: submissions.length > 0 ? '#C0392B' : '#6B6560',
              border: `1px solid ${submissions.length > 0 ? 'rgba(192,57,43,0.3)' : 'rgba(var(--c-line) / 0.08)'}`,
            }}
          >
            {submissions.length} PENDING
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="card h-32 animate-skeleton" />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="card py-14 text-center">
          <div className="text-3xl mb-3">✅</div>
          <div className="font-heading text-[13px] tracking-wider uppercase text-cream">
            All caught up
          </div>
          <div className="font-body text-[11px] text-warm-grey mt-1">
            No pending cut submissions.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const customer     = sub.profiles
            const gameCuts     = customer?.game_cuts ?? 0
            const gameLevel    = getGameLevel(gameCuts)
            const hofCount     = customer?.hall_of_fame_count ?? 0
            const isProcessing = !!processing[sub.id]
            const isRejecting  = rejectId === sub.id

            return (
              <div key={sub.id} className="card overflow-hidden">
                {/* Customer info row */}
                <div className="p-4 pb-3 border-b border-line/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-heading text-[14px] font-semibold tracking-wider uppercase text-cream">
                        {customer?.full_name || customer?.username || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[9px] text-warm-grey">@{customer?.username}</span>
                        <span className="font-mono text-[9px] text-warm-grey">·</span>
                        <span
                          className="font-heading text-[8px] tracking-wider uppercase"
                          style={{ color: gameLevel.color }}
                        >
                          {gameLevel.icon} {gameLevel.name}
                        </span>
                        {hofCount > 0 && (
                          <span className="font-heading text-[8px] tracking-wider" style={{ color: '#A0C8FF' }}>
                            🏆×{hofCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Game cut count */}
                    <div className="text-right">
                      <div className="font-display text-[20px] leading-none" style={{ color: gameLevel.color }}>
                        {gameCuts}
                      </div>
                      <div className="font-heading text-[7px] tracking-widest uppercase text-warm-grey">
                        GAME CUTS
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submission details */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-warm-grey">
                    <Clock size={11} />
                    <span className="font-body text-[11px]">
                      Cut on <span className="text-cream">{formatDate(sub.cut_date)}</span>
                      {' · '}Submitted {formatRelativeDate(sub.created_at)}
                    </span>
                  </div>

                  {sub.notes && (
                    <div className="font-body text-[11px] text-warm-grey italic">
                      "{sub.notes}"
                    </div>
                  )}

                  {/* Photo toggle */}
                  {sub.photo_url && (
                    <div>
                      <button
                        onClick={() => setExpandedPhoto(expandedPhoto === sub.id ? null : sub.id)}
                        className="flex items-center gap-1.5 text-clipper-red font-heading text-[10px] tracking-wider uppercase"
                      >
                        <Image size={11} />
                        {expandedPhoto === sub.id ? 'HIDE PHOTO' : 'VIEW PHOTO'}
                        {expandedPhoto === sub.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      {expandedPhoto === sub.id && (
                        <div className="mt-2 rounded-[10px] overflow-hidden">
                          <img
                            src={sub.photo_url}
                            alt="Cut photo"
                            className="w-full max-h-64 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons or reject form */}
                {isRejecting ? (
                  <div className="px-4 pb-4 space-y-3 border-t border-line/5 pt-3">
                    <textarea
                      className="input resize-none w-full"
                      rows={2}
                      placeholder="Reason for rejection (optional)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      maxLength={200}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase disabled:opacity-50 transition-all"
                        style={{ background: 'rgba(231,76,60,0.15)', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.3)' }}
                      >
                        {isProcessing ? 'REJECTING...' : 'CONFIRM REJECT'}
                      </button>
                      <button
                        onClick={() => setRejectId(null)}
                        className="px-4 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase text-warm-grey hover:text-cream transition-colors"
                        style={{ background: 'rgba(var(--c-line) / 0.05)' }}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pb-4 flex gap-2 border-t border-line/5 pt-3">
                    <button
                      onClick={() => handleApprove(sub)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase disabled:opacity-50 transition-all"
                      style={{ background: 'rgba(39,174,96,0.15)', color: '#27AE60', border: '1px solid rgba(39,174,96,0.3)' }}
                    >
                      <CheckCircle size={13} />
                      {isProcessing ? 'APPROVING...' : 'APPROVE'}
                    </button>
                    <button
                      onClick={() => openReject(sub.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase disabled:opacity-50 transition-all"
                      style={{ background: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.2)' }}
                    >
                      <XCircle size={13} />
                      REJECT
                    </button>
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
