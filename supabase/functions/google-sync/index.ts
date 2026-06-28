// ════════════════════════════════════════════════════════════════
// Edge Function: google-sync  (one-way: our DB → barber's Google Calendar)
//
// The database is the single source of truth; this mirrors a booking into
// the calendar the barber actually checks on their phone. Each barber
// authorizes once (OAuth) and we store a refresh token in
// barber_google_tokens. We keep appointments.google_event_id so updates and
// cancellations hit the same event.
//
//   POST { appointment_id, action: 'upsert' | 'delete' }
//
// Secrets:        GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
// Platform-given: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy:         supabase functions deploy google-sync --no-verify-jwt
// ════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function accessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) { console.error('Google token refresh failed', await res.text()); return null }
  return (await res.json()).access_token ?? null
}

Deno.serve(async (req) => {
  try {
    const { appointment_id, action = 'upsert' } = await req.json()
    if (!appointment_id) return json({ error: 'appointment_id required' }, 400)

    const { data: appt } = await admin
      .from('appointments')
      .select('id, barber_id, customer_name, customer_email, service_name, starts_at, ends_at, notes, google_event_id')
      .eq('id', appointment_id)
      .single()
    if (!appt || !appt.barber_id) {
      await mark(appointment_id, 'skipped')
      return json({ ok: true, skipped: 'no barber' })
    }

    const { data: tok } = await admin
      .from('barber_google_tokens')
      .select('refresh_token, calendar_id')
      .eq('barber_id', appt.barber_id)
      .single()
    if (!tok?.refresh_token) {
      await mark(appointment_id, 'skipped')
      return json({ ok: true, skipped: 'barber not connected' })
    }

    const token = await accessToken(tok.refresh_token)
    if (!token) { await mark(appointment_id, 'failed'); return json({ error: 'token refresh failed' }, 502) }

    const cal = encodeURIComponent(tok.calendar_id ?? 'primary')
    const base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

    // ── Delete (cancellation) ─────────────────────────────────────
    if (action === 'delete') {
      if (appt.google_event_id) {
        await fetch(`${base}/${appt.google_event_id}`, { method: 'DELETE', headers })
      }
      await admin.from('appointments')
        .update({ google_event_id: null, google_sync_status: 'synced' })
        .eq('id', appointment_id)
      return json({ ok: true, action: 'delete' })
    }

    // ── Upsert (create or reschedule) ─────────────────────────────
    const event = {
      summary: `${appt.service_name ?? 'Cut'} — ${appt.customer_name ?? 'Client'}`,
      description: [appt.customer_email, appt.notes].filter(Boolean).join('\n'),
      start: { dateTime: new Date(appt.starts_at).toISOString() },
      end: { dateTime: new Date(appt.ends_at).toISOString() },
    }
    const isUpdate = !!appt.google_event_id
    const res = await fetch(isUpdate ? `${base}/${appt.google_event_id}` : base, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify(event),
    })
    if (!res.ok) {
      console.error('Google event write failed', res.status, await res.text())
      await mark(appointment_id, 'failed')
      return json({ error: 'calendar write failed' }, 502)
    }
    const ev = await res.json()
    await admin.from('appointments')
      .update({ google_event_id: ev.id, google_sync_status: 'synced' })
      .eq('id', appointment_id)

    return json({ ok: true, action: isUpdate ? 'update' : 'create', event_id: ev.id })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

async function mark(id: string, status: string) {
  await admin.from('appointments').update({ google_sync_status: status }).eq('id', id)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
