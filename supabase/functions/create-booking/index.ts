// ════════════════════════════════════════════════════════════════
// Edge Function: create-booking  (PUBLIC, anon-callable)
//
// The front door for the website's custom booking flow. Validates input,
// checks a Turnstile token (bot protection), then calls the create_booking
// RPC with the service-role key — anon cannot INSERT appointments directly
// (007 grants no anon insert on purpose).
//
//   POST {
//     service_id, starts_at (ISO), customer_name, customer_email,
//     customer_phone?, barber_id?, notes?, idempotency_key?, turnstile_token?
//   }
//   ->  { appointment_id, status, deposit_required, deposit_cents,
//         booking_token, starts_at, ends_at }
//
// On deposit-required bookings the client then calls create-payment
// (type 'deposit') with the returned booking_token to get a Checkout URL.
//
// Secrets:        WEBSITE_ORIGIN, TURNSTILE_SECRET (optional in dev)
// Platform-given: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy:         supabase functions deploy create-booking --no-verify-jwt
// ════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { preflight, json, verifyTurnstile } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const p = await req.json().catch(() => ({}))

    const service_id = String(p.service_id ?? '')
    const starts_at = String(p.starts_at ?? '')
    const customer_name = String(p.customer_name ?? '').trim()
    const customer_email = String(p.customer_email ?? '').trim().toLowerCase()
    const customer_phone = p.customer_phone ? String(p.customer_phone).trim() : null
    const barber_id = p.barber_id ? String(p.barber_id) : null
    const notes = p.notes ? String(p.notes).slice(0, 1000) : null
    const idempotency_key = p.idempotency_key ? String(p.idempotency_key) : null

    // ── Input validation ──────────────────────────────────────────
    if (!service_id) return json(req, { error: 'service_id required' }, 400)
    if (!customer_name) return json(req, { error: 'customer_name required' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer_email)) {
      return json(req, { error: 'valid customer_email required' }, 400)
    }
    const startMs = Date.parse(starts_at)
    if (Number.isNaN(startMs)) return json(req, { error: 'valid starts_at required' }, 400)
    if (startMs < Date.now()) return json(req, { error: 'starts_at is in the past' }, 400)

    // ── Bot protection ────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
    const ok = await verifyTurnstile(p.turnstile_token, ip)
    if (!ok) return json(req, { error: 'bot_check_failed' }, 403)

    // ── Atomic booking via the RPC (service-role bypasses RLS) ─────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await admin.rpc('create_booking', {
      p_service_id: service_id,
      p_starts_at: new Date(startMs).toISOString(),
      p_customer_name: customer_name,
      p_customer_email: customer_email,
      p_customer_phone: customer_phone,
      p_barber_id: barber_id,
      p_notes: notes,
      p_idempotency_key: idempotency_key,
    })
    if (error) return json(req, { error: error.message }, 500)

    // RPC returns { error } for business failures (slot_taken, etc.).
    if (data?.error) {
      const status = data.error === 'slot_taken' ? 409
        : data.error === 'no_barber_available' ? 409
        : 400
      return json(req, data, status)
    }

    return json(req, data, 200)
  } catch (err) {
    return json(req, { error: String(err) }, 500)
  }
})
