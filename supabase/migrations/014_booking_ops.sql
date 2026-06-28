-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 014: Booking operations
--
-- Layer 6:  expire_pending_bookings()      — release unpaid-deposit holds
-- Layer 7:  cancel window + refund eligibility on cancel_appointment
-- Layer 8:  barber_google_tokens + sync dispatch
-- Layer 10: booking_events audit log, lifecycle dispatch, cron jobs
-- ════════════════════════════════════════════════════════════════

-- ─── Per-barber Google Calendar connection (one-way sync target) ──
CREATE TABLE IF NOT EXISTS barber_google_tokens (
  barber_id     UUID PRIMARY KEY REFERENCES barbers(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  calendar_id   TEXT NOT NULL DEFAULT 'primary',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE barber_google_tokens ENABLE ROW LEVEL SECURITY;
-- Tokens are secrets: only the service role (Edge Functions) touches them.
-- No policies = no anon/authenticated access; service role bypasses RLS.

-- ─── Cancellation policy knob ─────────────────────────────────────
ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS cancel_window_hours INTEGER NOT NULL DEFAULT 24;

-- ════════════════════════════════════════════════════════════════
-- Layer 10: audit log — every lifecycle change, for disputes + funnel.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS booking_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,   -- created|confirmed|rescheduled|cancelled|completed|no_show
  actor          TEXT,            -- 'system' | 'customer' | 'barber' | a uuid
  detail         JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_appt ON booking_events(appointment_id, created_at DESC);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_events: barber read"
  ON booking_events FOR SELECT USING (get_my_role() IN ('barber','admin'));

-- Record an event row on insert and on every status change.
CREATE OR REPLACE FUNCTION log_booking_event()
RETURNS TRIGGER AS $$
DECLARE
  v_actor TEXT := COALESCE(auth.uid()::text, 'system');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_events(appointment_id, event_type, actor, detail)
    VALUES (NEW.id, 'created', v_actor,
            jsonb_build_object('source', NEW.source, 'status', NEW.status));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO booking_events(appointment_id, event_type, actor, detail)
    VALUES (NEW.id,
            CASE NEW.status
              WHEN 'confirmed' THEN 'confirmed'
              WHEN 'cancelled' THEN 'cancelled'
              WHEN 'completed' THEN 'completed'
              WHEN 'no_show'   THEN 'no_show'
              ELSE NEW.status END,
            v_actor,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
  ELSIF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    INSERT INTO booking_events(appointment_id, event_type, actor, detail)
    VALUES (NEW.id, 'rescheduled', v_actor,
            jsonb_build_object('from', OLD.starts_at, 'to', NEW.starts_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appointments_audit ON appointments;
CREATE TRIGGER appointments_audit
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_booking_event();

-- ════════════════════════════════════════════════════════════════
-- Layers 7+8: dispatch side effects (customer confirmation, Google sync)
-- via pg_net, mirroring notify_barbers_on_booking (010). No-op until
-- app.functions_url is set, so bookings never fail on push/sync setup.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION dispatch_appointment_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT := current_setting('app.functions_url', true);
  v_key TEXT := current_setting('app.service_role_key', true);
  v_hdr JSONB;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RETURN NEW; END IF;
  v_hdr := jsonb_build_object('Content-Type','application/json',
                              'Authorization','Bearer ' || COALESCE(v_key,''));

  -- Customer confirmation + calendar create when a booking becomes confirmed.
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    PERFORM net.http_post(v_url || '/send-booking-confirmation', v_hdr,
                          jsonb_build_object('appointment_id', NEW.id));
    PERFORM net.http_post(v_url || '/google-sync', v_hdr,
                          jsonb_build_object('appointment_id', NEW.id, 'action','upsert'));

  -- Reschedule of an active booking → update the calendar event.
  ELSIF TG_OP = 'UPDATE' AND NEW.starts_at IS DISTINCT FROM OLD.starts_at
        AND NEW.status IN ('pending','confirmed') THEN
    PERFORM net.http_post(v_url || '/google-sync', v_hdr,
                          jsonb_build_object('appointment_id', NEW.id, 'action','upsert'));

  -- Cancellation → remove the calendar event.
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    PERFORM net.http_post(v_url || '/google-sync', v_hdr,
                          jsonb_build_object('appointment_id', NEW.id, 'action','delete'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appointments_dispatch_sync ON appointments;
CREATE TRIGGER appointments_dispatch_sync
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION dispatch_appointment_sync();

-- ════════════════════════════════════════════════════════════════
-- Layer 6: expire unpaid-deposit holds so the slot frees up.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE appointments
       SET status = 'cancelled'
     WHERE status = 'pending'
       AND deposit_status = 'pending'
       AND hold_expires_at IS NOT NULL
       AND hold_expires_at < NOW()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- Layer 7: cancellation with refund-eligibility (free cancel window).
-- Replaces 007's cancel_appointment. Cancel is always allowed (unless
-- completed); whether the deposit is refundable depends on the window.
-- ════════════════════════════════════════════════════════════════
-- Drop 007's single-arg version so a one-arg call resolves here, not there.
DROP FUNCTION IF EXISTS cancel_appointment(UUID);

CREATE OR REPLACE FUNCTION cancel_appointment(
  p_appointment_id UUID,
  p_token          TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_appt   appointments%ROWTYPE;
  v_window INT;
  v_refundable BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF NOT (
    (p_token IS NOT NULL AND p_token = v_appt.booking_token)
    OR auth.uid() = v_appt.customer_id
    OR get_my_role() IN ('barber','admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_appt.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot cancel a completed appointment';
  END IF;

  SELECT cancel_window_hours INTO v_window FROM booking_settings WHERE id = TRUE;

  -- Deposit refundable if cancelled at least cancel_window_hours before start,
  -- or if a barber/admin cancels (shop-side cancellation always refunds).
  IF v_appt.deposit_status = 'paid' THEN
    v_refundable := get_my_role() IN ('barber','admin')
                    OR v_appt.starts_at - NOW() >= make_interval(hours => v_window);
  END IF;

  UPDATE appointments SET status = 'cancelled' WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'status', 'cancelled',
    'deposit_refundable', v_refundable);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- token-gated for guests (same as reschedule); anon may call.
GRANT EXECUTE ON FUNCTION cancel_appointment(UUID, TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Cron (optional; needs pg_cron). Mirrors the send-reminders schedule.
-- Safe to skip if you trigger functions via an external scheduler.
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule(
      'expire-pending-bookings', '*/5 * * * *',
      'SELECT expire_pending_bookings();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not configured; schedule expire_pending_bookings() externally.';
END $$;
