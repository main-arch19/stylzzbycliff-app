-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 012: Availability model + overlap guard
--
-- Until now appointments were *imported* from an external calendar. To
-- let customers book directly on the website we need to know WHEN each
-- barber works, WHICH services they offer, and to make double-booking
-- impossible at the database level.
--
-- Layer 1: barber_schedules, schedule_exceptions, barber_services,
--          booking_settings (+ per-service buffer).
-- Layer 3: a partial EXCLUDE constraint so two overlapping appointments
--          for the same barber can never both exist.
-- ════════════════════════════════════════════════════════════════

-- btree_gist lets a GiST exclusion constraint mix uuid equality (=) with
-- a tstzrange overlap (&&). Required for the no-overlap guard below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Recurring weekly hours per barber ────────────────────────────
-- weekday: 0=Sunday .. 6=Saturday (matches Postgres EXTRACT(DOW)).
CREATE TABLE IF NOT EXISTS barber_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_barber_schedules_barber
  ON barber_schedules(barber_id, weekday);

-- ─── One-off overrides: days off, holidays, special hours ─────────
-- is_closed=TRUE  → barber is off that whole date (overrides weekly grid).
-- is_closed=FALSE → bespoke hours for that date (start_time/end_time set).
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_closed   BOOLEAN NOT NULL DEFAULT TRUE,
  start_time  TIME,
  end_time    TIME,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (barber_id, date),
  CHECK (is_closed OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_barber_date
  ON schedule_exceptions(barber_id, date);

-- ─── Which barber offers which service (multi-barber math) ─────────
-- Optional per-barber overrides; NULL falls back to the service default.
CREATE TABLE IF NOT EXISTS barber_services (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id              UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id             UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price_cents_override   INTEGER,
  duration_min_override  INTEGER CHECK (duration_min_override IS NULL OR duration_min_override > 0),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (barber_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_barber_services_service ON barber_services(service_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_barber  ON barber_services(barber_id);

-- ─── Shop-wide booking policy (single row, id=TRUE) ───────────────
CREATE TABLE IF NOT EXISTS booking_settings (
  id                   BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- enforce a single row
  timezone             TEXT    NOT NULL DEFAULT 'America/New_York',
  min_notice_min       INTEGER NOT NULL DEFAULT 60,    -- no booking sooner than this
  max_advance_days     INTEGER NOT NULL DEFAULT 60,    -- no booking further out than this
  slot_granularity_min INTEGER NOT NULL DEFAULT 15,    -- candidate start times step
  hold_minutes         INTEGER NOT NULL DEFAULT 15,    -- pending-deposit hold before auto-cancel
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO booking_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ─── Per-service cleanup buffer (cut + tidy before next client) ────
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer_min INTEGER NOT NULL DEFAULT 0;

-- ════════════════════════════════════════════════════════════════
-- Layer 3: the no-overlap guard.
--
-- A partial EXCLUDE constraint: for any single barber, two appointments
-- whose [starts_at, ends_at) ranges overlap cannot both exist — UNLESS
-- one is cancelled/completed/no_show. The database itself rejects the
-- race that two browsers booking the same slot would otherwise create.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (
    barber_id IS NOT NULL
    AND ends_at IS NOT NULL
    AND status IN ('pending', 'confirmed')
  );

-- ════════════════════════════════════════════════════════════════
-- RLS — schedules/services are publicly readable so the marketing site
-- can render availability without a login; only barbers/admins write.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE barber_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_settings    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barber_schedules: public read"
  ON barber_schedules FOR SELECT USING (TRUE);
CREATE POLICY "barber_schedules: barber manage"
  ON barber_schedules FOR ALL USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "schedule_exceptions: public read"
  ON schedule_exceptions FOR SELECT USING (TRUE);
CREATE POLICY "schedule_exceptions: barber manage"
  ON schedule_exceptions FOR ALL USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "barber_services: public read"
  ON barber_services FOR SELECT USING (TRUE);
CREATE POLICY "barber_services: barber manage"
  ON barber_services FOR ALL USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "booking_settings: public read"
  ON booking_settings FOR SELECT USING (TRUE);
CREATE POLICY "booking_settings: admin manage"
  ON booking_settings FOR ALL USING (get_my_role() = 'admin');

-- ─── Make the existing services catalog publicly readable too ─────
-- (007 gated this behind a login; the website needs prices pre-auth.)
DROP POLICY IF EXISTS "services: public read" ON services;
CREATE POLICY "services: public read"
  ON services FOR SELECT USING (is_active = TRUE);
