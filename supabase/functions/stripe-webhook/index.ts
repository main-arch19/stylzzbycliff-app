// ════════════════════════════════════════════════════════════════
// Edge Function: stripe-webhook
// Confirms payments. On checkout.session.completed it marks the payment
// row paid; for a deposit it also flips the appointment to confirmed.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Deploy with --no-verify-jwt (Stripe calls it unauthenticated; the
// signature check below is the auth).
// ════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook signature failed: ${err}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata ?? {}
    const paymentId = meta.payment_id
    const pi = typeof session.payment_intent === 'string' ? session.payment_intent : null

    if (paymentId) {
      await admin
        .from('payments')
        .update({ status: 'paid', stripe_payment_intent_id: pi })
        .eq('id', paymentId)
    }

    if (meta.type === 'deposit' && meta.appointment_id) {
      await admin
        .from('appointments')
        .update({ deposit_status: 'paid', status: 'confirmed' })
        .eq('id', meta.appointment_id)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
