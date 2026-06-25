import { useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { MOCK_MODE } from '@/lib/mockData'

// Compose + send an email blast to every customer whose email has been
// collected. Lives directly under the greeting on the barber dashboard.
// The send-broadcast Edge Function does the role check + actual sending.
export default function BroadcastBox() {
  const toast = useToast()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending

  const reset = () => {
    setSubject('')
    setBody('')
    setConfirming(false)
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)

    // No backend in mock mode — don't pretend to email anyone.
    if (MOCK_MODE) {
      toast('Mock mode — no email sent', 'info')
      setSending(false)
      reset()
      return
    }

    const { data, error } = await supabase.functions.invoke('send-broadcast', {
      body: { subject: subject.trim(), body: body.trim() },
    })

    if (error || data?.error) {
      toast(data?.error || 'Broadcast failed.', 'error')
    } else {
      const n = data?.sent ?? 0
      toast(`Sent to ${n} customer${n === 1 ? '' : 's'}`, 'success')
      reset()
    }
    setSending(false)
  }

  return (
    <div className="card p-4 mb-6 border border-clipper-red/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-[8px] bg-clipper-red/15 flex items-center justify-center shrink-0">
          <Megaphone size={16} className="text-clipper-red" />
        </div>
        <div className="min-w-0">
          <div className="font-heading text-[9px] tracking-widest uppercase text-warm-grey">BROADCAST</div>
          <div className="font-heading text-[13px] tracking-wider uppercase text-cream truncate">Message all customers</div>
        </div>
      </div>

      <input
        className="input w-full mb-2"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={150}
        disabled={sending}
      />
      <textarea
        className="input resize-none w-full mb-3"
        rows={4}
        placeholder="Write your message to every customer…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        disabled={sending}
      />

      {confirming ? (
        <div className="flex gap-2 items-center">
          <span className="font-heading text-[10px] tracking-wider uppercase text-warm-grey flex-1">
            Send to all customers?
          </span>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase disabled:opacity-50 transition-all"
            style={{ background: 'rgba(192,57,43,0.15)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.3)' }}
          >
            {sending ? 'SENDING…' : 'CONFIRM SEND'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={sending}
            className="px-4 py-2.5 rounded-[10px] font-heading text-[11px] tracking-wider uppercase text-warm-grey hover:text-cream transition-colors disabled:opacity-50"
            style={{ background: 'rgba(var(--c-line) / 0.05)' }}
          >
            CANCEL
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          disabled={!canSend}
          className="btn btn-primary w-full gap-2 disabled:opacity-50"
        >
          <Send size={14} />
          SEND BROADCAST
        </button>
      )}
    </div>
  )
}
