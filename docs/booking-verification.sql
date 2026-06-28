-- ════════════════════════════════════════════════════════════════
-- Booking engine — end-to-end smoke test (run in the Supabase SQL editor)
--
-- Proves: slot engine respects hours + bookings, the no-overlap guard
-- rejects double-booking, and the deposit hold sweep frees abandoned
-- slots. Wrapped in a transaction with ROLLBACK so it leaves no data.
-- Replace the seed barber/service if you already have real ones.
-- ════════════════════════════════════════════════════════════════
BEGIN;

-- ── Seed a barber + service + Tuesday 09:00–17:00 hours ──────────
WITH b AS (
  INSERT INTO barbers (name, is_active) VALUES ('Test Barber', TRUE) RETURNING id
), s AS (
  INSERT INTO services (name, duration_min, price_cents, deposit_cents, buffer_min, is_active)
  VALUES ('Test Fade', 30, 3500, 0, 10, TRUE) RETURNING id
)
INSERT INTO barber_schedules (barber_id, weekday, start_time, end_time)
SELECT b.id, 2, '09:00', '17:00' FROM b;

INSERT INTO barber_services (barber_id, service_id)
SELECT (SELECT id FROM barbers WHERE name='Test Barber'),
       (SELECT id FROM services WHERE name='Test Fade');

-- Note: queries below target next Tuesday — (date_trunc('week', now()) +
-- interval '1 week 1 day')::date — so the weekday + min_notice checks pass.

-- ── 1. Slot engine returns slots for an open day ─────────────────
SELECT jsonb_array_length(
  (get_available_slots(
     (SELECT id FROM services WHERE name='Test Fade'),
     (date_trunc('week', now()) + interval '1 week 1 day')::date
   )->'slots')
) AS slot_count_should_be_positive;

-- ── 2. Book a slot, then confirm it (and its buffer) disappears ──
SELECT create_booking(
  (SELECT id FROM services WHERE name='Test Fade'),
  (date_trunc('week', now()) + interval '1 week 1 day')::date + time '10:00',
  'Race One', 'race1@example.com'
) AS first_booking_should_confirm;

-- 10:00 should now be gone from availability.
SELECT NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(
    (get_available_slots(
       (SELECT id FROM services WHERE name='Test Fade'),
       (date_trunc('week', now()) + interval '1 week 1 day')::date)->'slots') slot
  WHERE (slot->>'starts_at')::timestamptz
        = (date_trunc('week', now()) + interval '1 week 1 day')::date + time '10:00'
) AS booked_slot_is_gone;

-- ── 3. No-overlap guard: a second booking at 10:00 must fail ─────
SELECT create_booking(
  (SELECT id FROM services WHERE name='Test Fade'),
  (date_trunc('week', now()) + interval '1 week 1 day')::date + time '10:00',
  'Race Two', 'race2@example.com'
) ->> 'error' AS should_be_slot_taken;   -- expect: slot_taken

-- ── 4. Deposit hold sweep frees an expired pending booking ───────
UPDATE services SET deposit_cents = 1000 WHERE name='Test Fade';
SELECT create_booking(
  (SELECT id FROM services WHERE name='Test Fade'),
  (date_trunc('week', now()) + interval '1 week 1 day')::date + time '11:00',
  'Hold Test', 'hold@example.com'
) ->> 'status' AS should_be_pending;     -- expect: pending

-- Force the hold into the past, then sweep.
UPDATE appointments SET hold_expires_at = NOW() - interval '1 minute'
WHERE customer_email = 'hold@example.com';
SELECT expire_pending_bookings() AS swept_should_be_1;   -- expect: 1
SELECT status FROM appointments WHERE customer_email='hold@example.com'; -- expect: cancelled

-- Leave the database untouched.
ROLLBACK;
