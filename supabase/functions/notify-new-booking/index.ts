// ════════════════════════════════════════════════════════════════
// Edge Function: notify-new-booking
// Pushes every barber/admin when a website booking lands.
// Invoked by the appointments AFTER INSERT trigger (migration 010):
//   POST { appointment_id }
//
// Deploy with --no-verify-jwt (called by the DB trigger via pg_net).
// Reuses _shared/push.ts (sendToCustomer is keyed on profiles.id, so it
// targets barber profiles just as well as customers).
// ════════════════════════════════════════════════════════════════
import { supabase, sendToCustomer } from '../_shared/push.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  try {
    const { appointment_id } = await req.json()
    if (!appointment_id) return json({ error: 'appointment_id required' }, 400)

    const { data: appt } = await supabase
      .from('appointments')
      .select('customer_name, service_name, starts_at')
      .eq('id', appointment_id)
      .single()
    if (!appt) return json({ error: 'appointment not found' }, 404)

    const { data: barbers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['barber', 'admin'])

    const when = new Date(appt.starts_at).toLocaleString('en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit',
    })

    let sent = 0
    for (const b of barbers ?? []) {
      const r = await sendToCustomer(b.id, {
        title: 'New booking 📅',
        body: `${appt.customer_name ?? 'Someone'} · ${appt.service_name ?? 'Cut'} · ${when}`,
        url: '/admin',
        tag: `booking-${appointment_id}`,
      })
      sent += r.sent
    }
    return json({ sent })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
