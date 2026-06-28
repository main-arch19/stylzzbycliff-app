# Supabase Edge Functions

Server-side functions for push notifications (Phase 2) and payments (Phase 3).
They run on Supabase's Deno runtime and are deployed with the Supabase CLI.

```
supabase/functions/
  _shared/push.ts        Shared Web Push helper (VAPID + sendToCustomer)
  send-push/             On-demand push to one customer
  send-reminders/        Scheduled: appointment reminders + streak nudges
  create-payment-intent/ (Phase 3) Stripe PaymentIntent for tips/balance
  stripe-webhook/        (Phase 3) Confirms Stripe payments
```

---

## Web Push (Phase 2)

### 1. Generate VAPID keys (once)

```bash
npx web-push generate-vapid-keys
```

### 2. Set secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BNxx... \
  VAPID_PRIVATE_KEY=xxxx... \
  VAPID_SUBJECT=mailto:you@yourshop.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 3. Expose the public key to the app

Put the **public** key in the web app env (it's safe to expose):

```
VITE_VAPID_PUBLIC_KEY=BNxx...
```

The client (`src/hooks/useWebPush.js`) subscribes the browser and stores the
subscription in `push_subscriptions` (migration `008_push.sql`).

> iOS only delivers Web Push when the PWA is **installed to the home screen**.

### 4. Deploy

```bash
supabase functions deploy send-push
supabase functions deploy send-reminders
```

### 5. Test a single push

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"<uuid>","title":"Test 🔥","body":"It works","url":"/"}'
```

### 6. Schedule reminders (hourly)

`send-reminders` is built for an **hourly** cadence (its time windows assume it).
Schedule it with `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'stylzz-hourly-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

(or use the Supabase dashboard's scheduled functions / any external cron.)

### 7. New-booking push to the barber

When the website calendar inserts a `source='website'` appointment, a trigger
(`notify_barbers_on_booking`, migration `010`) calls `notify-new-booking`, which
pushes every `barber`/`admin` who has notifications enabled.

```bash
supabase functions deploy notify-new-booking --no-verify-jwt
```

Enable `pg_net` and point the trigger at your functions host (run once):

```sql
create extension if not exists pg_net with schema extensions;
alter database postgres set app.functions_url   = 'https://<project-ref>.functions.supabase.co';
alter database postgres set app.service_role_key = '<service-role-key>';
```

Until `app.functions_url` is set the trigger is a no-op, so calendar inserts
keep working before push is configured. The barber enables notifications with
the same toggle as customers (Profile → Notifications).

---

## Payments (Phase 3)

In-app payments are **tips / balance** via Stripe **Checkout** (hosted page), so
no card data touches the app. Deposits (if any) are taken on the external
booking calendar.

### 1. Secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  APP_URL=https://app.stylzzbycliff.com
```

### 2. Deploy

```bash
supabase functions deploy create-payment
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe calls it unauthenticated
```

### 3. Register the webhook in Stripe

Point a Stripe webhook at
`https://<project-ref>.functions.supabase.co/stripe-webhook` and subscribe to
`checkout.session.completed`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

### 4. Flow

- The client (`src/hooks/useTip.js`) calls `create-payment` with the customer's
  JWT → gets a Checkout URL → redirects the browser to it.
- After payment, Stripe fires `checkout.session.completed` → `stripe-webhook`
  marks the `payments` row `paid` (and, for a deposit, confirms the appointment).

### Test (Stripe test mode)

Use card `4242 4242 4242 4242`, any future expiry/CVC. Watch the `payments`
table flip from `pending` to `paid`.

---

## Broadcast email (Resend)

`send-broadcast` emails every customer whose email has been collected
(`profiles` where `role='customer'` and `email is not null`). It's invoked from
the barber dashboard's "message all customers" box and is **gated to barber/admin
callers** server-side. Each customer is emailed individually (no shared To/BCC).
Every blast is logged to the `broadcasts` table (migration `011_broadcasts.sql`).

### 1. Set up Resend (once)

1. Create a free [Resend](https://resend.com) account.
2. **Add and verify your sending domain** (`stylzzbycliff.com`) — add the
   SPF/DKIM DNS records Resend gives you. Without a verified domain, mail is
   rejected or lands in spam.
3. Create an API key.

> Free tier: **100 emails/day, 3,000/month**. A larger list needs a paid plan.

### 2. Set secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  BROADCAST_FROM='StylzzByCliff <hello@stylzzbycliff.com>'
```

`BROADCAST_FROM` must use the verified domain. `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 3. Apply the migration + deploy

```bash
supabase db push                      # creates the broadcasts audit table
supabase functions deploy send-broadcast
```

### 4. Test

```bash
# Use a BARBER/ADMIN user's JWT (a customer JWT must get 403).
curl -X POST "$SUPABASE_URL/functions/v1/send-broadcast" \
  -H "Authorization: Bearer <barber-or-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test 🔥","body":"Hey from the shop!"}'
# -> { "sent": <number of customers emailed> }
```

> Compliance: bulk mail should carry an unsubscribe path + the shop's name. The
> function adds a "Reply STOP to opt out" footer; a real `email_opt_out` flag on
> `profiles` (filtered in the recipient query) is the proper fast-follow.

---

## Custom booking engine (Phase 4)

Customers book directly on the marketing website. Bookings land in the **same
`appointments` table**, so they inherit completion → `log_cut` (XP/streak/tier),
payments, push, reminders, and the dashboard — one system for web + app.

Migrations: `012_availability.sql` (schedules, exceptions, barber↔service,
settings, no-overlap guard), `013_booking_rpcs.sql` (slot engine + booking RPCs),
`014_booking_ops.sql` (audit log, hold expiry, Google sync dispatch, cron).

Functions:

```
create-booking/            Public: validate + bot-check + create_booking RPC
send-booking-confirmation/ Customer confirmation (push if account, email always)
google-sync/               One-way DB → barber's Google Calendar
create-payment/            Extended: type='deposit' (guest, via booking_token)
_shared/cors.ts            CORS + Turnstile helpers for public endpoints
```

### 1. Configure the shop

```sql
-- One row already seeded; tune to taste.
update booking_settings set
  timezone = 'America/New_York',
  min_notice_min = 60, max_advance_days = 60,
  slot_granularity_min = 15, hold_minutes = 15, cancel_window_hours = 24;

-- Per-barber weekly hours (weekday 0=Sun..6=Sat) and which services they do.
insert into barber_schedules (barber_id, weekday, start_time, end_time)
  values ('<barber-uuid>', 2, '09:00', '17:00');     -- Tuesday 9–5
insert into barber_services (barber_id, service_id)
  values ('<barber-uuid>', '<service-uuid>');
-- Optional per-service cleanup buffer:
update services set buffer_min = 10 where id = '<service-uuid>';
```

### 2. Secrets + deploy

```bash
supabase secrets set \
  WEBSITE_ORIGIN='https://stylzzbycliff.com' \
  WEBSITE_URL='https://stylzzbycliff.com' \
  TURNSTILE_SECRET='0x...' \
  GOOGLE_OAUTH_CLIENT_ID='...' GOOGLE_OAUTH_CLIENT_SECRET='...'

supabase db push
supabase functions deploy create-booking            --no-verify-jwt
supabase functions deploy create-payment            --no-verify-jwt   # guest deposit path
supabase functions deploy send-booking-confirmation --no-verify-jwt
supabase functions deploy google-sync               --no-verify-jwt
```

`app.functions_url` / `app.service_role_key` (set once in the Web Push section
above) also drive the booking confirmation + Google-sync dispatch triggers.
Until they're set, those side effects are silent no-ops and bookings still work.

### 3. Website flow

1. `GET` services (anon read) + `rpc('get_available_slots', { p_service_id, p_date })`
   to render open times.
2. `POST create-booking` with `{ service_id, starts_at, customer_name,
   customer_email, customer_phone?, barber_id?, idempotency_key, turnstile_token }`.
   - No-deposit service → `status: 'confirmed'`, customer gets confirmation, done.
   - Deposit service → `status: 'pending'` + a `booking_token`; then
     `POST create-payment { type:'deposit', booking_token }` → redirect to the
     Checkout `url`. The webhook flips the appointment to `confirmed` on payment.
3. Abandoned deposits auto-cancel after `hold_minutes` (cron `expire-pending-bookings`).

### 4. Google Calendar (one-way)

Store each barber's OAuth refresh token in `barber_google_tokens` (do the OAuth
consent flow once; offline access / refresh token). Confirm/reschedule/cancel
then mirror to their calendar automatically via the dispatch trigger.

### 5. Verify

See `docs/booking-verification.sql` for an end-to-end smoke test (seed hours,
check the slot engine, prove double-booking is rejected, run the hold sweep).
