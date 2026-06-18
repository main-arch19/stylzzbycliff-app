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
