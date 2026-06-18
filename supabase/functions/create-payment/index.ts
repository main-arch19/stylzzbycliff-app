// ════════════════════════════════════════════════════════════════
// Edge Function: create-payment
// Creates a Stripe Checkout Session for an in-app tip or balance and
// returns its hosted URL. No card data ever touches the app.
//
// Called by the signed-in customer:
//   POST { amount_cents, type: 'tip'|'balance', appointment_id? }
//   -> { url }   (redirect the browser here)
//
// Secrets: STRIPE_SECRET_KEY, APP_URL (e.g. https://app.stylzzbycliff.com)
// Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

const LABELS: Record<string, string> = {
  tip: 'Tip for your barber',
  balance: 'Balance payment',
}

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

    const { amount_cents, type, appointment_id } = await req.json()
    if (!Number.isInteger(amount_cents) || amount_cents < 100 || amount_cents > 50_000) {
      return json({ error: 'amount_cents must be between 100 and 50000' }, 400)
    }
    if (type !== 'tip' && type !== 'balance') {
      return json({ error: "type must be 'tip' or 'balance'" }, 400)
    }

    // Service-role client for writes (bypasses RLS).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

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
    if (insErr) return json({ error: insErr.message }, 500)

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

    return json({ url: session.url })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
