// ════════════════════════════════════════════════════════════════
// Edge Function: send-broadcast
// Sends one email to every customer whose email has been collected.
// Composed from the barber dashboard's "message all customers" box.
//
// Called by a signed-in barber/admin:
//   POST { subject, body }  ->  { sent }
//
// Each customer is emailed individually (no shared To/BCC) so addresses
// are never exposed to one another. Resend's batch endpoint sends up to
// 100 messages per request, so we chunk the recipient list.
//
// Secrets:        RESEND_API_KEY, BROADCAST_FROM
// Platform-given: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const BROADCAST_FROM = Deno.env.get('BROADCAST_FROM') ?? 'StylzzByCliff <hello@stylzzbycliff.com>'
const SHOP_NAME = 'StylzzByCliff'

const BATCH_SIZE = 100 // Resend /emails/batch limit

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // Identify the caller from their JWT.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    // Service-role client: role check + recipient read + audit insert (bypasses RLS).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Authorize: only staff may broadcast to the whole customer base.
    const { data: me } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!me || (me.role !== 'barber' && me.role !== 'admin')) {
      return json({ error: 'Forbidden' }, 403)
    }

    // Validate input.
    const payload = await req.json().catch(() => ({}))
    const subject = String(payload.subject ?? '').trim()
    const body = String(payload.body ?? '').trim()
    if (subject.length < 1 || subject.length > 150) {
      return json({ error: 'subject must be 1-150 characters' }, 400)
    }
    if (body.length < 1 || body.length > 5000) {
      return json({ error: 'body must be 1-5000 characters' }, 400)
    }

    // Recipients: every customer whose email has been collected.
    const { data: customers, error: custErr } = await admin
      .from('profiles')
      .select('email')
      .eq('role', 'customer')
      .not('email', 'is', null)
    if (custErr) return json({ error: custErr.message }, 500)

    const emails = [...new Set(
      (customers ?? [])
        .map((c) => (c.email ?? '').trim().toLowerCase())
        .filter((e) => e.length > 0),
    )]
    if (emails.length === 0) return json({ sent: 0 })

    const html = renderHtml(subject, body)

    // Send in batches of 100 (one message per recipient).
    let sent = 0
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE)
      const messages = chunk.map((to) => ({ from: BROADCAST_FROM, to, subject, html }))

      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      if (res.ok) {
        sent += chunk.length
      } else {
        // Don't fail the whole blast on one bad batch — log and keep going.
        console.error('Resend batch failed', res.status, await res.text())
      }
    }

    // Audit log (best-effort).
    await admin.from('broadcasts').insert({
      sender_id: user.id,
      subject,
      body,
      recipient_count: sent,
    })

    return json({ sent })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(subject: string, body: string) {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>')
  return `<!doctype html>
<html>
  <body style="margin:0;background:#1E1E1E;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#F2EFEA;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:18px;letter-spacing:1px;text-transform:uppercase;margin:0 0 20px;color:#F2EFEA;">${escapeHtml(subject)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#D9D4CE;">${safeBody}</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:28px 0 14px;" />
      <p style="font-size:11px;color:#6B6560;line-height:1.5;margin:0;">
        You're receiving this because you're a ${SHOP_NAME} customer.
        Reply STOP to opt out of future messages.
      </p>
    </div>
  </body>
</html>`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
