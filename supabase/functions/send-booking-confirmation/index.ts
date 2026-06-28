// ════════════════════════════════════════════════════════════════
// Edge Function: send-booking-confirmation
// Tells the CUSTOMER their booking is confirmed. Today only the barber is
// notified (notify-new-booking); this closes the loop for the customer.
//   - Push if they have an account with a registered device.
//   - Email always (the only reliable channel for a guest booker), and the
//     email nudges guests to claim their bookings + start earning XP.
//
//   POST { appointment_id }   (server-to-server, from the DB trigger)
//
// Secrets:        RESEND_API_KEY, BROADCAST_FROM, APP_URL,
//                 VAPID_* (for push)
// Platform-given: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy:         supabase functions deploy send-booking-confirmation --no-verify-jwt
// ════════════════════════════════════════════════════════════════
import { supabase, sendToCustomer } from '../_shared/push.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('BROADCAST_FROM') ?? 'StylzzByCliff <hello@stylzzbycliff.com>'
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

Deno.serve(async (req) => {
  try {
    const { appointment_id } = await req.json()
    if (!appointment_id) return json({ error: 'appointment_id required' }, 400)

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, customer_id, customer_email, customer_name, service_name, starts_at, booking_token')
      .eq('id', appointment_id)
      .single()
    if (!appt) return json({ error: 'not found' }, 404)

    const when = new Date(appt.starts_at).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })

    // Push to the account holder (if any device is registered).
    let pushed = { sent: 0, pruned: 0 }
    if (appt.customer_id) {
      pushed = await sendToCustomer(appt.customer_id, {
        title: 'Booking confirmed ✅',
        body: `${appt.service_name ?? 'Your cut'} · ${when}`,
        url: '/appointments',
        tag: `confirm-${appt.id}`,
      })
    }

    // Email confirmation (always — the only channel a guest has).
    let emailed = false
    if (RESEND_API_KEY && appt.customer_email) {
      const isGuest = !appt.customer_id
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: appt.customer_email,
          subject: `You're booked — ${when}`,
          html: renderHtml(appt.customer_name, appt.service_name, when, isGuest),
        }),
      })
      emailed = res.ok
      if (!res.ok) console.error('Resend failed', res.status, await res.text())
    }

    return json({ ok: true, pushed, emailed })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderHtml(name: string | null, service: string | null, when: string, isGuest: boolean) {
  const claim = isGuest
    ? `<p style="font-size:14px;line-height:1.6;color:#D9D4CE;">
         Create a free account with this email to manage your booking and start
         earning rewards on every cut.
         <a href="${APP_URL}/signup" style="color:#C9A24B;">Claim your account →</a>
       </p>`
    : `<p style="font-size:14px;line-height:1.6;color:#D9D4CE;">
         <a href="${APP_URL}/appointments" style="color:#C9A24B;">View your appointment →</a>
       </p>`
  return `<!doctype html><html><body style="margin:0;background:#1E1E1E;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#F2EFEA;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:18px;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px;">Booking confirmed</h1>
      <p style="font-size:15px;line-height:1.6;color:#D9D4CE;">
        ${escapeHtml(name || 'King')}, you're locked in for
        <strong style="color:#F2EFEA;">${escapeHtml(service || 'your cut')}</strong>
        on <strong style="color:#F2EFEA;">${escapeHtml(when)}</strong>.
      </p>
      ${claim}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:28px 0 14px;" />
      <p style="font-size:11px;color:#6B6560;margin:0;">StylzzByCliff · Reply to this email to reach the shop.</p>
    </div></body></html>`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
