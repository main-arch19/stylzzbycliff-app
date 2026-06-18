// Shared Web Push helper for the Edge Functions.
// Sets up the Supabase service-role client + VAPID once, and exposes
// sendToCustomer(), which delivers to every device a customer has
// registered and prunes dead subscriptions.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@stylzzbycliff.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendToCustomer(customerId: string, payload: PushPayload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('customer_id', customerId)

  const body = JSON.stringify(payload)
  let sent = 0
  const dead: string[] = []

  await Promise.allSettled(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
        sent++
      } catch (err: any) {
        // 404/410 mean the subscription is gone — prune it.
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint)
      }
    }),
  )

  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead)
  }
  return { sent, pruned: dead.length }
}
