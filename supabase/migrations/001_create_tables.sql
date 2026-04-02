-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff Loyalty App — Migration 001: Create Tables
-- ════════════════════════════════════════════════════════════════

-- ─── Enable required extensions ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Helper: generate 8-char alphanumeric referral code ──────────
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ─── profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username         TEXT UNIQUE NOT NULL,
  full_name        TEXT,
  avatar_url       TEXT,
  referral_code    TEXT UNIQUE NOT NULL DEFAULT generate_referral_code(),
  referred_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_xp         INTEGER NOT NULL DEFAULT 0,
  total_cuts       INTEGER NOT NULL DEFAULT 0,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_cut_date    DATE,
  membership_tier  TEXT NOT NULL DEFAULT 'bronze' CHECK (membership_tier IN ('bronze','silver','gold','platinum')),
  spins_available  INTEGER NOT NULL DEFAULT 0,
  role             TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','barber','admin')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── barbers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barbers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  specialty   TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── cuts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  barber_id    UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  style        TEXT NOT NULL,
  xp_earned    INTEGER NOT NULL DEFAULT 150,
  notes        TEXT,
  confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── rewards ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  icon           TEXT,
  cuts_required  INTEGER NOT NULL,
  xp_bonus       INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── claimed_rewards ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claimed_rewards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id    UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  redeemed     BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at  TIMESTAMPTZ,
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── badges ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  criteria_type   TEXT NOT NULL CHECK (criteria_type IN ('cuts_count','streak','referrals','styles_tried','time_based')),
  criteria_value  INTEGER NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── earned_badges ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earned_badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id     UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, badge_id)
);

-- ─── challenges ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  challenge_type      TEXT NOT NULL CHECK (challenge_type IN ('cuts_in_period','try_new_style','referral','check_in')),
  target_value        INTEGER NOT NULL,
  reward_description  TEXT,
  reward_xp           INTEGER NOT NULL DEFAULT 0,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── challenge_progress ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id   UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  current_value  INTEGER NOT NULL DEFAULT 0,
  completed      BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  UNIQUE (customer_id, challenge_id)
);

-- ─── check_ins ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_ins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_earned    INTEGER NOT NULL DEFAULT 50,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one check-in per customer per day
  CONSTRAINT one_checkin_per_day UNIQUE (customer_id, (created_at::DATE))
);

-- ─── spin_results ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spin_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prize        TEXT NOT NULL,
  redeemed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── crews ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  captain_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── crew_members ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crew_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id    UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crew_id, member_id)
);

-- ─── season_passes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_passes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  total_tiers  INTEGER NOT NULL DEFAULT 10,
  xp_per_tier  INTEGER NOT NULL DEFAULT 500,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── season_pass_progress ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_pass_progress (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_pass_id   UUID NOT NULL REFERENCES season_passes(id) ON DELETE CASCADE,
  current_tier     INTEGER NOT NULL DEFAULT 0,
  tier_xp          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (customer_id, season_pass_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cuts_customer ON cuts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cuts_barber ON cuts(barber_id);
CREATE INDEX IF NOT EXISTS idx_cuts_created ON cuts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_earned_badges_customer ON earned_badges(customer_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_customer ON challenge_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_customer ON check_ins(customer_id);
CREATE INDEX IF NOT EXISTS idx_spin_results_customer ON spin_results(customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_referral ON profiles(referral_code);

-- ════════════════════════════════════════════════════════════════
-- Trigger: auto-create profile on new auth user
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
