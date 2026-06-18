# Booking Integration Contract

The StylzzByCliff app does **not** create bookings. A separate booking
calendar/website (built later) is the producer; it writes appointments into the
**same Supabase database** the app reads from. The app ingests, matches each
booking to a customer **by email**, displays them, and lets the barber complete
them — which auto-logs the cut and awards all gamification (XP, streak, spins,
badges, tier, season pass) via the existing `log_cut` pipeline.

This document is the contract the calendar must follow so it "drops in" cleanly.

---

## How the calendar writes a booking

Insert (or upsert) a row into the `appointments` table using the Supabase
**service-role key from a server** (never the browser — the service-role key
bypasses Row-Level Security and must stay secret).

```js
// On the booking website's backend (Node, edge function, etc.)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side only
)

await supabase
  .from('appointments')
  .upsert(
    {
      customer_email: 'king@example.com', // REQUIRED — used to match the app user
      customer_name:  'Cliff King',
      service_name:   'Skin Fade',
      starts_at:      '2026-06-20T15:00:00Z', // REQUIRED (ISO 8601, UTC)
      ends_at:        '2026-06-20T15:30:00Z',
      barber_id:      null,   // optional; set if the calendar knows the barber
      status:         'confirmed',
      source:         'website',
      external_ref:   'cal_evt_12345', // REQUIRED — stable id for idempotent upserts
      notes:          'Booked via website',
    },
    { onConflict: 'external_ref' }
  )
```

## Field reference

| Column           | Required | Notes |
|------------------|----------|-------|
| `customer_email` | ✅ | Lower-cased and matched against `profiles.email`. If no account exists yet, the row is still stored and shows in the admin "unmatched" queue; it auto-links when that email signs up. |
| `starts_at`      | ✅ | ISO 8601 timestamp (UTC recommended). |
| `external_ref`   | ✅ | Stable unique id from the calendar. Re-sending the same `external_ref` **updates** the existing row instead of duplicating it. |
| `source`         | ✅ | Set to `'website'` (or `'external'`) so it's distinguishable from in-app/walk-in rows. |
| `ends_at`        | ➖ | Optional; used for the schedule day-view. |
| `service_name`   | ➖ | Free text; used as the cut "style" on completion if no style is entered. |
| `barber_id`      | ➖ | A `barbers.id`. Leave null if unknown; the barber is required only to **complete** the appointment. |
| `customer_name`  | ➖ | Display fallback for unmatched bookings. |
| `notes`          | ➖ | Free text. |
| `status`         | ➖ | Defaults to `confirmed`. One of `pending`, `confirmed`, `completed`, `cancelled`, `no_show`. Don't send `completed` — the shop marks completion in-app so rewards fire. |

Do **not** set `customer_id` or `cut_id` — those are managed by the database
(matching trigger) and the app (completion), respectively.

## Matching behaviour (handled by migration 007)

- A `BEFORE INSERT/UPDATE` trigger resolves `customer_id` from
  `profiles.email = lower(customer_email)`.
- Unmatched bookings (no account with that email) are kept and surfaced in the
  admin **Schedule → Unmatched** queue, where a barber can link them by hand
  (`link_appointment` RPC).
- When someone later signs up with that email, a `profiles` trigger
  auto-links any waiting unmatched bookings.

## Completion → rewards (handled in-app)

The barber marks an appointment complete in **Admin → Schedule**, which calls
`complete_appointment(appointment_id, style)`. That reuses `log_cut`, so the
customer's XP/streak/spins/badges/tier/season-pass all update exactly as a
manually logged cut would, and the appointment's `cut_id` is filled in.

## Security checklist for the calendar

- Service-role key lives **only** on the calendar's server, never in client code.
- Treat `external_ref` as stable and unique per booking.
- Send times in UTC to avoid timezone drift.
