-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 007: Booking / Appointments
--
-- Bookings are CREATED by an external calendar/website that writes into
-- this same database (see docs/booking-integration.md). This app ingests,
-- matches by email, displays, and completes them. Completing an
-- appointment reuses log_cut() so every gamification side effect
-- (XP, streak, spins, badges, tier, season pass) fires automatically.
-- ════════════════════════════════════════════════════════════════

-- ─── profiles.email (enables email-based matching) ────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(lower(email));

-- Backfill from the auth table for existing users.
UPDATE profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');

-- Re-create the new-user trigger so future signups capture email too.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url, referral_code, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    generate_referral_code(),
    lower(NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── services (light catalog the calendar can reference) ──────────
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 30,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── appointments (written by the external calendar) ──────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- null until matched
  customer_email  TEXT,
  customer_name   TEXT,
  barber_id       UUID REFERENCES barbers(id) ON DELETE SET NULL,
  service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name    TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  source          TEXT NOT NULL DEFAULT 'app'
                    CHECK (source IN ('app','website','external')),
  external_ref    TEXT UNIQUE,           -- stable id from the calendar (idempotent upserts)
  cut_id          UUID REFERENCES cuts(id) ON DELETE SET NULL,  -- set on completion
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_barber  ON appointments(barber_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_starts  ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_email   ON appointments(lower(customer_email));

-- ════════════════════════════════════════════════════════════════
-- Matching: resolve an incoming booking's email to a profile
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION match_appointment_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL AND NEW.customer_email IS NOT NULL THEN
    SELECT id INTO NEW.customer_id
    FROM profiles
    WHERE lower(email) = lower(NEW.customer_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appointments_match_customer ON appointments;
CREATE TRIGGER appointments_match_customer
  BEFORE INSERT OR UPDATE OF customer_email, customer_id ON appointments
  FOR EACH ROW EXECUTE FUNCTION match_appointment_to_customer();

-- When a profile is created/changes email, link any waiting unmatched bookings.
CREATE OR REPLACE FUNCTION backfill_appointments_for_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE appointments
    SET customer_id = NEW.id
    WHERE customer_id IS NULL AND lower(customer_email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_backfill_appointments ON profiles;
CREATE TRIGGER profiles_backfill_appointments
  AFTER INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW EXECUTE FUNCTION backfill_appointments_for_profile();

-- ════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services: public read"
  ON services FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "services: barber manage"
  ON services FOR ALL
  USING (get_my_role() IN ('barber','admin'));

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Customers read their own appointments.
CREATE POLICY "appointments: own read"
  ON appointments FOR SELECT
  USING (auth.uid() = customer_id);

-- Customers may cancel their own (status update handled in cancel_appointment).
CREATE POLICY "appointments: own update"
  ON appointments FOR UPDATE
  USING (auth.uid() = customer_id);

-- Barbers/admins manage everything (incl. the unmatched queue).
CREATE POLICY "appointments: barber all"
  ON appointments FOR ALL
  USING (get_my_role() IN ('barber','admin'));

-- NOTE: the external calendar writes with the service-role key, which
-- bypasses RLS. No anon insert policy is granted on purpose.

-- ════════════════════════════════════════════════════════════════
-- RPCs (SECURITY DEFINER, JSONB, matching log_cut conventions)
-- ════════════════════════════════════════════════════════════════

-- complete_appointment: marks done and runs the full cut pipeline.
CREATE OR REPLACE FUNCTION complete_appointment(
  p_appointment_id UUID,
  p_style          TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_appt   appointments%ROWTYPE;
  v_style  TEXT;
  v_result JSONB;
BEGIN
  IF get_my_role() NOT IN ('barber','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_appt.status = 'completed' THEN
    RAISE EXCEPTION 'Appointment already completed';
  END IF;
  IF v_appt.customer_id IS NULL THEN
    RAISE EXCEPTION 'Appointment is not linked to a customer yet';
  END IF;
  IF v_appt.barber_id IS NULL THEN
    RAISE EXCEPTION 'Appointment has no barber assigned';
  END IF;

  v_style := COALESCE(NULLIF(trim(p_style), ''), v_appt.service_name, 'Custom Style');

  -- Reuse the core pipeline: XP, streak, spins, badges, tier, season pass.
  v_result := log_cut(v_appt.customer_id, v_appt.barber_id, v_style);

  UPDATE appointments SET
    status = 'completed',
    cut_id = (v_result->>'cut_id')::UUID
  WHERE id = p_appointment_id;

  RETURN v_result || jsonb_build_object('appointment_id', p_appointment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- link_appointment: admin/barber manually attaches an unmatched booking.
CREATE OR REPLACE FUNCTION link_appointment(
  p_appointment_id UUID,
  p_customer_id    UUID
)
RETURNS JSONB AS $$
BEGIN
  IF get_my_role() NOT IN ('barber','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE appointments SET customer_id = p_customer_id
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('appointment_id', p_appointment_id, 'customer_id', p_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cancel_appointment: the customer (own) or a barber/admin can cancel.
CREATE OR REPLACE FUNCTION cancel_appointment(p_appointment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_appt appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF NOT (auth.uid() = v_appt.customer_id OR get_my_role() IN ('barber','admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_appt.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot cancel a completed appointment';
  END IF;

  UPDATE appointments SET status = 'cancelled' WHERE id = p_appointment_id;
  RETURN jsonb_build_object('appointment_id', p_appointment_id, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
