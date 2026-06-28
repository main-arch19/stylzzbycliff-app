-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 013: Booking RPCs
--
-- Layer 2: get_available_slots()      — public, anon-callable slot engine
-- Layer 4: create_booking()           — atomic, idempotent booking write
-- Layer 7: reschedule_appointment()   — move to a new validated slot
--
-- All SECURITY DEFINER + JSONB to match log_cut / complete_appointment.
-- The overlap guard from 012 (appointments_no_overlap) is the hard
-- arbiter for double-booking; these RPCs add friendly hours/notice
-- checks and return clean errors.
-- ════════════════════════════════════════════════════════════════

-- ─── Columns the booking flow needs on appointments ───────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
-- Opaque token so a GUEST (no account) can pay a deposit / view / cancel
-- their own booking without exposing the row to every anon caller.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_token    TEXT UNIQUE;
-- When an unpaid-deposit hold expires (auto-cancel sweep releases the slot).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hold_expires_at  TIMESTAMPTZ;
-- One-way Google Calendar mirror bookkeeping (Layer 8).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id  TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_sync_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (google_sync_status IN ('pending','synced','failed','skipped'));

CREATE INDEX IF NOT EXISTS idx_appointments_hold
  ON appointments(hold_expires_at) WHERE deposit_status = 'pending';

-- A guest deposit is paid before any account exists, so a payment row may
-- have no customer yet — it's identified by its appointment instead. Relax
-- the NOT NULL and require at least one of (customer_id, appointment_id).
ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_has_owner;
ALTER TABLE payments ADD CONSTRAINT payments_has_owner
  CHECK (customer_id IS NOT NULL OR appointment_id IS NOT NULL);

-- ════════════════════════════════════════════════════════════════
-- get_available_slots(service, date [, barber])
--   Returns: { date, service_id, duration_min, slots: [ {barber_id,
--     barber_name, starts_at, ends_at} ... ] }
--   Anon-callable (SECURITY DEFINER) so the public site can render times.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_available_slots(
  p_service_id UUID,
  p_date       DATE,
  p_barber_id  UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tz          TEXT;
  v_min_notice  INT;
  v_max_advance INT;
  v_granule     INT;
  v_svc         services%ROWTYPE;
  v_now         TIMESTAMPTZ := NOW();
  v_slots       JSONB := '[]'::jsonb;
  v_barber      RECORD;
  v_window      RECORD;
  v_duration    INT;
  v_buffer      INT;
  v_slot_start  TIMESTAMPTZ;
  v_slot_end    TIMESTAMPTZ;
BEGIN
  SELECT timezone, min_notice_min, max_advance_days, slot_granularity_min
    INTO v_tz, v_min_notice, v_max_advance, v_granule
    FROM booking_settings WHERE id = TRUE;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found', 'slots', '[]'::jsonb);
  END IF;

  -- Date must be within [today, today + max_advance] in the shop's timezone.
  IF p_date < (v_now AT TIME ZONE v_tz)::date
     OR p_date > (v_now AT TIME ZONE v_tz)::date + v_max_advance THEN
    RETURN jsonb_build_object('date', p_date, 'service_id', p_service_id, 'slots', '[]'::jsonb);
  END IF;

  -- Candidate barbers: active, offering this service (optionally pinned).
  FOR v_barber IN
    SELECT b.id, b.name,
           COALESCE(bs.duration_min_override, v_svc.duration_min) AS duration_min
    FROM barbers b
    JOIN barber_services bs ON bs.barber_id = b.id AND bs.service_id = p_service_id
    WHERE b.is_active AND bs.is_active
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
  LOOP
    v_duration := v_barber.duration_min;
    v_buffer   := COALESCE(v_svc.buffer_min, 0);

    -- Working window(s) for the date: an exception overrides the weekly grid.
    FOR v_window IN
      WITH exc AS (
        SELECT is_closed, start_time, end_time
        FROM schedule_exceptions
        WHERE barber_id = v_barber.id AND date = p_date
      )
      SELECT e.start_time, e.end_time FROM exc e WHERE NOT e.is_closed
      UNION ALL
      SELECT s.start_time, s.end_time
      FROM barber_schedules s
      WHERE s.barber_id = v_barber.id
        AND s.is_active
        AND s.weekday = EXTRACT(DOW FROM p_date)::int
        AND NOT EXISTS (SELECT 1 FROM exc)   -- weekly grid only if no exception
    LOOP
      -- Step granularity across the window; keep slots that fit + clear notice.
      FOR v_slot_start IN
        SELECT gs FROM generate_series(
          ((p_date::timestamp + v_window.start_time) AT TIME ZONE v_tz),
          ((p_date::timestamp + v_window.end_time)   AT TIME ZONE v_tz)
            - make_interval(mins => v_duration),
          make_interval(mins => v_granule)
        ) gs
      LOOP
        v_slot_end := v_slot_start + make_interval(mins => v_duration);

        IF v_slot_start < v_now + make_interval(mins => v_min_notice) THEN
          CONTINUE;  -- too soon
        END IF;

        -- Free if no active appointment (expanded by buffer) overlaps it.
        IF NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.barber_id = v_barber.id
            AND a.status IN ('pending','confirmed')
            AND a.ends_at IS NOT NULL
            AND tstzrange(
                  a.starts_at - make_interval(mins => v_buffer),
                  a.ends_at   + make_interval(mins => v_buffer), '[)'
                ) && tstzrange(v_slot_start, v_slot_end, '[)')
        ) THEN
          v_slots := v_slots || jsonb_build_object(
            'barber_id', v_barber.id,
            'barber_name', v_barber.name,
            'starts_at', v_slot_start,
            'ends_at',   v_slot_end
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'date',         p_date,
    'service_id',   p_service_id,
    'duration_min', v_svc.duration_min,
    'slots',        v_slots
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- create_booking — one transaction: pick/validate barber, insert the
-- appointment, let appointments_no_overlap guarantee no double-book.
--   Idempotent on p_idempotency_key (stored as external_ref).
--   No deposit  → status 'confirmed' immediately.
--   Deposit > 0 → status 'pending', deposit_status 'pending', hold set.
-- Returns: { appointment_id, status, deposit_cents, deposit_required,
--            booking_token, barber_id, starts_at, ends_at }
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_booking(
  p_service_id      UUID,
  p_starts_at       TIMESTAMPTZ,
  p_customer_name   TEXT,
  p_customer_email  TEXT,
  p_customer_phone  TEXT  DEFAULT NULL,
  p_barber_id       UUID  DEFAULT NULL,
  p_notes           TEXT  DEFAULT NULL,
  p_idempotency_key TEXT  DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_svc        services%ROWTYPE;
  v_duration   INT;
  v_buffer     INT;
  v_ends_at    TIMESTAMPTZ;
  v_barber_id  UUID := p_barber_id;
  v_deposit    INT;
  v_hold_min   INT;
  v_token      TEXT;
  v_existing   appointments%ROWTYPE;
  v_appt_id    UUID;
  v_status     TEXT;
  v_dep_status TEXT;
BEGIN
  IF p_customer_name IS NULL OR trim(p_customer_name) = ''
     OR p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RETURN jsonb_build_object('error', 'name_and_email_required');
  END IF;

  -- Idempotency: a retried/double-tapped submit returns the first booking.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM appointments WHERE external_ref = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'appointment_id', v_existing.id, 'status', v_existing.status,
        'deposit_cents', v_existing.deposit_cents,
        'deposit_required', v_existing.deposit_status = 'pending',
        'booking_token', v_existing.booking_token,
        'barber_id', v_existing.barber_id,
        'starts_at', v_existing.starts_at, 'ends_at', v_existing.ends_at,
        'idempotent_replay', TRUE
      );
    END IF;
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  SELECT hold_minutes INTO v_hold_min FROM booking_settings WHERE id = TRUE;
  v_buffer := COALESCE(v_svc.buffer_min, 0);

  -- "Any available" → pick the first barber who offers the service, works
  -- then, and is free (buffer-aware). Pinned barber must offer the service.
  IF v_barber_id IS NULL THEN
    SELECT b.id INTO v_barber_id
    FROM barbers b
    JOIN barber_services bs ON bs.barber_id = b.id AND bs.service_id = p_service_id
    WHERE b.is_active AND bs.is_active
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.barber_id = b.id AND a.status IN ('pending','confirmed') AND a.ends_at IS NOT NULL
          AND tstzrange(a.starts_at - make_interval(mins => v_buffer),
                        a.ends_at   + make_interval(mins => v_buffer), '[)')
              && tstzrange(p_starts_at,
                           p_starts_at + make_interval(mins =>
                             COALESCE(bs.duration_min_override, v_svc.duration_min)), '[)')
      )
    ORDER BY b.created_at
    LIMIT 1;
  END IF;

  IF v_barber_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_barber_available');
  END IF;

  v_duration := COALESCE(
    (SELECT duration_min_override FROM barber_services
       WHERE barber_id = v_barber_id AND service_id = p_service_id),
    v_svc.duration_min);
  v_ends_at := p_starts_at + make_interval(mins => v_duration);
  v_deposit := COALESCE(v_svc.deposit_cents, 0);

  IF v_deposit > 0 THEN
    v_status := 'pending'; v_dep_status := 'pending';
  ELSE
    v_status := 'confirmed'; v_dep_status := 'none';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  BEGIN
    INSERT INTO appointments (
      customer_email, customer_name, customer_phone, barber_id, service_id,
      service_name, starts_at, ends_at, status, source, external_ref,
      deposit_cents, deposit_status, hold_expires_at, booking_token, notes
    ) VALUES (
      lower(trim(p_customer_email)), trim(p_customer_name), p_customer_phone,
      v_barber_id, p_service_id, v_svc.name, p_starts_at, v_ends_at,
      v_status, 'website', p_idempotency_key,
      v_deposit, v_dep_status,
      CASE WHEN v_deposit > 0 THEN NOW() + make_interval(mins => v_hold_min) END,
      v_token, p_notes
    )
    RETURNING id INTO v_appt_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN jsonb_build_object('error', 'slot_taken');
    WHEN unique_violation THEN  -- external_ref race: return the winner
      SELECT * INTO v_existing FROM appointments WHERE external_ref = p_idempotency_key;
      RETURN jsonb_build_object('appointment_id', v_existing.id, 'status', v_existing.status,
        'deposit_cents', v_existing.deposit_cents,
        'deposit_required', v_existing.deposit_status = 'pending',
        'booking_token', v_existing.booking_token, 'idempotent_replay', TRUE);
  END;

  RETURN jsonb_build_object(
    'appointment_id',   v_appt_id,
    'status',           v_status,
    'deposit_cents',    v_deposit,
    'deposit_required', v_deposit > 0,
    'booking_token',    v_token,
    'barber_id',        v_barber_id,
    'starts_at',        p_starts_at,
    'ends_at',          v_ends_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- reschedule_appointment — move to a new start; overlap guard re-checks.
--   Auth: the booking_token (guest), the owning customer, or barber/admin.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reschedule_appointment(
  p_appointment_id UUID,
  p_new_starts_at  TIMESTAMPTZ,
  p_token          TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_appt      appointments%ROWTYPE;
  v_duration  INT;
  v_new_end   TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF NOT (
    (p_token IS NOT NULL AND p_token = v_appt.booking_token)
    OR auth.uid() = v_appt.customer_id
    OR get_my_role() IN ('barber','admin')
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_appt.status NOT IN ('pending','confirmed') THEN
    RETURN jsonb_build_object('error', 'not_reschedulable');
  END IF;

  v_duration := EXTRACT(EPOCH FROM (v_appt.ends_at - v_appt.starts_at)) / 60;
  v_new_end  := p_new_starts_at + make_interval(mins => v_duration::int);

  BEGIN
    UPDATE appointments
      SET starts_at = p_new_starts_at,
          ends_at   = v_new_end,
          google_sync_status = 'pending'
      WHERE id = p_appointment_id;
  EXCEPTION WHEN exclusion_violation THEN
    RETURN jsonb_build_object('error', 'slot_taken');
  END;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'starts_at', p_new_starts_at, 'ends_at', v_new_end);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Let the public (anon) read availability; writes go via the
--     create-booking Edge Function (service-role), never anon directly. ─
GRANT EXECUTE ON FUNCTION get_available_slots(UUID, DATE, UUID) TO anon, authenticated;
-- reschedule is token-gated inside the function (guests pass booking_token),
-- so anon may call it; a wrong/absent token returns not_authorized.
GRANT EXECUTE ON FUNCTION reschedule_appointment(UUID, TIMESTAMPTZ, TEXT) TO anon, authenticated;
