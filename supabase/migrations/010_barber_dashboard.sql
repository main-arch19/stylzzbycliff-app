-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 010: Barber Master Dashboard
--
-- 1. get_barber_dashboard(): one round-trip of the at-a-glance numbers.
-- 2. notify_barbers_on_booking(): push the barber when a website booking
--    lands. No-op until the function URL is configured, so external
--    calendar inserts always succeed regardless of push setup.
-- ════════════════════════════════════════════════════════════════

-- ─── Dashboard aggregates ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_barber_dashboard()
RETURNS JSONB AS $$
DECLARE
  v_today      DATE        := CURRENT_DATE;
  v_week_ago   TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  v_decay_date DATE        := CURRENT_DATE - 20;  -- DECAY_WARNING_THRESHOLD
  v_next       JSONB;
BEGIN
  IF get_my_role() NOT IN ('barber','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT to_jsonb(t) INTO v_next FROM (
    SELECT starts_at, customer_name, service_name
    FROM appointments
    WHERE status IN ('pending','confirmed') AND starts_at >= NOW()
    ORDER BY starts_at ASC
    LIMIT 1
  ) t;

  RETURN jsonb_build_object(
    'appointments_today', (
      SELECT count(*) FROM appointments
      WHERE starts_at::date = v_today AND status IN ('pending','confirmed')),
    'next_appointment', v_next,
    'cuts_today', (SELECT count(*) FROM cuts WHERE created_at::date = v_today),
    'cuts_week',  (SELECT count(*) FROM cuts WHERE created_at >= v_week_ago),
    'tips_today_cents', (
      SELECT COALESCE(sum(amount_cents),0) FROM payments
      WHERE status = 'paid' AND type IN ('tip','balance') AND created_at::date = v_today),
    'tips_week_cents', (
      SELECT COALESCE(sum(amount_cents),0) FROM payments
      WHERE status = 'paid' AND type IN ('tip','balance') AND created_at >= v_week_ago),
    'pending_approvals',    (SELECT count(*) FROM cut_submissions WHERE status = 'pending'),
    'pending_redemptions',  (SELECT count(*) FROM claimed_rewards WHERE redeemed = FALSE),
    'decay_risk', (
      SELECT count(*) FROM profiles
      WHERE role = 'customer' AND game_cuts > 0
        AND last_cut_date IS NOT NULL AND last_cut_date <= v_decay_date),
    'unmatched_bookings', (
      SELECT count(*) FROM appointments
      WHERE customer_id IS NULL AND status NOT IN ('cancelled','completed')),
    'website_bookings_upcoming', (
      SELECT count(*) FROM appointments
      WHERE source = 'website' AND status IN ('pending','confirmed') AND starts_at >= NOW()),
    'new_customers_week', (
      SELECT count(*) FROM profiles WHERE role = 'customer' AND created_at >= v_week_ago)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Push the barber on a new website booking ─────────────────────
-- Requires (set once by the owner; see supabase/functions/README.md):
--   ALTER DATABASE postgres SET app.functions_url = 'https://<ref>.functions.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';
--   CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- Until app.functions_url is set the trigger is a no-op (inserts still succeed).
CREATE OR REPLACE FUNCTION notify_barbers_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT := current_setting('app.functions_url', true);
  v_key TEXT := current_setting('app.service_role_key', true);
BEGIN
  IF NEW.source = 'website' AND v_url IS NOT NULL AND v_url <> '' THEN
    PERFORM net.http_post(
      url     := v_url || '/notify-new-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_key, '')
      ),
      body    := jsonb_build_object('appointment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appointments_notify_barbers ON appointments;
CREATE TRIGGER appointments_notify_barbers
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_barbers_on_booking();
