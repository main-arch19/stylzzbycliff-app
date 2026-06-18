// ════════════════════════════════════════════════════════════════
// Edge Function: send-reminders  (run on a schedule — hourly)
//
// Sends the engagement-loop pushes that fire on real events:
//   • Appointment reminders   ~24h and ~2h before start
//   • Streak-at-risk nudge     when a customer hits the inactivity warning
//
// Schedule it hourly (Supabase cron / pg_cron / external cron). The time
// windows assume an hourly cadence so each appointment is reminded once.
// See supabase/functions/README.md.
// ════════════════════════════════════════════════════════════════
import { supabase, sendToCustomer } from '../_shared/push.ts'

// Keep in sync with DECAY_WARNING_THRESHOLD in src/utils/constants.js
const DECAY_WARNING_DAYS = 20

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3_600_000).toISOString()
}

async function remindWindow(fromH: number, toH: number, tagSuffix: string, lead: string) {
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, customer_id, service_name, starts_at')
    .in('status', ['pending', 'confirmed'])
    .not('customer_id', 'is', null)
    .gte('starts_at', hoursFromNow(fromH))
    .lt('starts_at', hoursFromNow(toH))

  let sent = 0
  for (const a of appts ?? []) {
    const time = new Date(a.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const res = await sendToCustomer(a.customer_id, {
      title: lead,
      body: `${a.service_name ?? 'Your cut'} at ${time}. Tap for details.`,
      url: '/appointments',
      tag: `appt-${a.id}-${tagSuffix}`,
    })
    sent += res.sent
  }
  return sent
}

async function remindStreakAtRisk() {
  // Customers whose last visit was exactly the warning threshold ago today.
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - DECAY_WARNING_DAYS)
  const day = threshold.toISOString().split('T')[0]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, current_streak')
    .eq('last_cut_date', day)
    .gt('current_streak', 0)

  let sent = 0
  for (const p of profiles ?? []) {
    const res = await sendToCustomer(p.id, {
      title: "Don't break the streak 🔥",
      body: "It's been a minute, King. Book a cut before your credit slips.",
      url: '/appointments',
      tag: `streak-${p.id}`,
    })
    sent += res.sent
  }
  return sent
}

Deno.serve(async () => {
  try {
    const results = {
      reminders24h: await remindWindow(23, 24, '24h', "You're up tomorrow 🔥"),
      reminders2h: await remindWindow(1, 2, '2h', 'See you soon ✂️'),
      streakAtRisk: await remindStreakAtRisk(),
    }
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
