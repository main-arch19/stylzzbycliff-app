// ════════════════════════════════════════════════════════════════
// Edge Function: create-payment
// Creates a Stripe Checkout Session and returns its hosted URL. No card
// data ever touches the app. Two modes:
//
//  1. Tip / balance (signed-in customer, JWT):
//       POST { amount_cents, type: 'tip'|'balance', appointment_id? }
//
//  2. Booking deposit (GUEST, no account — authed by booking_token):
//       POST { type: 'deposit', booking_token }
//     Amount is taken from the appointment's deposit_cents (never trusted
//     from the client). On payment the webhook flips the appointment to
//     'confirmed' (see stripe-webhook).
//
//   -> { url }   (redirect the browser here)
//
// Secrets: STRIPE_SECRET_KEY, APP_URL, WEBSITE_URL (deposit return target)
// Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Deploy the deposit path needs --no-verify-jwt (guests have no JWT).
// ════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { preflight, corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const WEBSITE_URL = Deno.env.get('WEBSITE_URL') ?? APP_URL

const LABELS: Record<string, string> = {
  tip: 'Tip for your barber',
  balance: 'Balance payment',
  deposit: 'Booking deposit',
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json().catch(() => ({}))
    const type = body.type

    // ── Mode 2: guest booking deposit (authed by booking_token) ───────
    if (type === 'deposit') {
      const token = String(body.booking_token ?? '')
      if (!token) return json(req, { error: 'booking_token required' }, 400)

      const { data: appt } = await admin
        .from('appointments')
        .select('id, customer_id, deposit_cents, deposit_status, status, service_name')
        .eq('booking_token', token)
        .single()
      if (!appt) return json(req, { error: 'booking not found' }, 404)
      if (appt.deposit_status === 'paid') return json(req, { error: 'deposit already paid' }, 409)
      if (!(appt.deposit_cents > 0)) return json(req, { error: 'no deposit due' }, 400)

      const { data: payment, error: insErr } = await admin
        .from('payments')
        .insert({
          customer_id: appt.customer_id ?? null,
          appointment_id: appt.id,
          amount_cents: appt.deposit_cents,
          type: 'deposit',
          status: 'pending',
        })
        .select()
        .single()
      if (insErr) return json(req, { error: insErr.message }, 500)

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: appt.deposit_cents,
            product_data: { name: `${LABELS.deposit} — ${appt.service_name ?? ''}`.trim() },
          },
        }],
        success_url: `${WEBSITE_URL}/booking/confirmed?token=${token}`,
        cancel_url: `${WEBSITE_URL}/booking/canceled?token=${token}`,
        metadata: {
          payment_id: payment.id,
          appointment_id: appt.id,
          type: 'deposit',
        },
      })
      await admin.from('payments').update({ stripe_session_id: session.id }).eq('id', payment.id)
      return json(req, { url: session.url })
    }

    // ── Mode 1: signed-in tip / balance (JWT) ─────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(req, { error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json(req, { error: 'Unauthorized' }, 401)

    const { amount_cents, appointment_id } = body
    if (!Number.isInteger(amount_cents) || amount_cents < 100 || amount_cents > 50_000) {
      return json(req, { error: 'amount_cents must be between 100 and 50000' }, 400)
    }
    if (type !== 'tip' && type !== 'balance') {
      return json(req, { error: "type must be 'tip', 'balance' or 'deposit'" }, 400)
    }

    const { data: payment, error: insErr } = await admin
      .from('payments')
      .insert({
        customer_id: user.id,
        appointment_id: appointment_id ?? null,
        amount_cents,
        type,
        status: 'pending',
      })
      .select()
      .single()
    if (insErr) return json(req, { error: insErr.message }, 500)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount_cents,
          product_data: { name: LABELS[type] ?? 'Payment' },
        },
      }],
      success_url: `${APP_URL}/appointments?paid=1`,
      cancel_url: `${APP_URL}/appointments?canceled=1`,
      metadata: {
        payment_id: payment.id,
        customer_id: user.id,
        appointment_id: appointment_id ?? '',
        type,
      },
    })

    await admin.from('payments').update({ stripe_session_id: session.id }).eq('id', payment.id)

    return json(req, { url: session.url })
  } catch (err) {
    return json(req, { error: String(err) }, 500)
  }
})

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
