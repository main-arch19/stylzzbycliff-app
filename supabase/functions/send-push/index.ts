// ════════════════════════════════════════════════════════════════
// Edge Function: send-push
// Delivers a Web Push notification to all of one customer's devices.
//
// Invoke server-to-server (service-role) or from another Edge Function:
//   POST { customer_id, title, body, url?, tag? }
//
// Required secrets (see supabase/functions/README.md):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by the platform)
// ════════════════════════════════════════════════════════════════
import { sendToCustomer } from '../_shared/push.ts'

Deno.serve(async (req) => {
  try {
    const { customer_id, title, body, url, tag } = await req.json()
    if (!customer_id || !title) {
      return new Response(JSON.stringify({ error: 'customer_id and title required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const result = await sendToCustomer(customer_id, { title, body: body ?? '', url, tag })
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
