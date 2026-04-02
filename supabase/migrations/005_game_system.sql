-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 005: Game System
-- Adds: leveling, cut submissions, admin approval, decay
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Add game columns to profiles ─────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS game_cuts              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hall_of_fame_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decay_periods_applied  INTEGER NOT NULL DEFAULT 0;

-- ─── 2. Make barber_id nullable in cuts ──────────────────────────
-- Customer-submitted cuts don't have an associated barber
ALTER TABLE cuts ALTER COLUMN barber_id DROP NOT NULL;

-- ─── 3. cut_submissions table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cut_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cut_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url        TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cut_submissions_customer_idx ON cut_submissions(customer_id);
CREATE INDEX IF NOT EXISTS cut_submissions_status_idx   ON cut_submissions(status);

-- ─── 4. RLS for cut_submissions ───────────────────────────────────
ALTER TABLE cut_submissions ENABLE ROW LEVEL SECURITY;

-- Customers can read their own submissions
CREATE POLICY "customers_read_own_submissions" ON cut_submissions
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Customers can create submissions for themselves only
CREATE POLICY "customers_insert_own_submissions" ON cut_submissions
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Barbers/admins can read and update all submissions
CREATE POLICY "admin_read_all_submissions" ON cut_submissions
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "admin_update_all_submissions" ON cut_submissions
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('barber','admin'));

-- ─── 5. Supabase Storage bucket for cut photos ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('cut-photos', 'cut-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'authenticated_upload_cut_photos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "authenticated_upload_cut_photos" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'cut-photos')
    $policy$;
  END IF;
END $$;

-- ─── 6. RPC: submit_cut_request ──────────────────────────────────
CREATE OR REPLACE FUNCTION submit_cut_request(
  p_customer_id UUID,
  p_cut_date    DATE,
  p_photo_url   TEXT DEFAULT NULL,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_submission_id UUID;
BEGIN
  -- Prevent duplicate pending submissions within 2 hours
  IF EXISTS (
    SELECT 1 FROM cut_submissions
    WHERE customer_id = p_customer_id
      AND status = 'pending'
      AND created_at > NOW() - INTERVAL '2 hours'
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'You already have a pending submission. Wait for it to be reviewed before submitting another.'
    );
  END IF;

  INSERT INTO cut_submissions (customer_id, cut_date, photo_url, notes)
  VALUES (p_customer_id, p_cut_date, p_photo_url, p_notes)
  RETURNING id INTO v_submission_id;

  RETURN jsonb_build_object('success', TRUE, 'submission_id', v_submission_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 7. RPC: approve_cut_submission ──────────────────────────────
-- Approving a submission has the same side effects as log_cut
-- (XP, tier, streak, badges, challenges, season pass)
-- PLUS increments game_cuts and handles Hall of Fame.
CREATE OR REPLACE FUNCTION approve_cut_submission(
  p_submission_id UUID,
  p_admin_id      UUID
)
RETURNS JSONB AS $$
DECLARE
  v_submission      cut_submissions%ROWTYPE;
  v_profile         profiles%ROWTYPE;
  v_cut_id          UUID;
  v_xp_earned       INTEGER := 150;
  v_new_total_xp    INTEGER;
  v_new_total_cuts  INTEGER;
  v_new_streak      INTEGER;
  v_new_tier        TEXT;
  v_new_spins       INTEGER;
  v_new_game_cuts   INTEGER;
  v_new_hof_count   INTEGER;
  v_hall_of_fame    BOOLEAN := FALSE;
  v_badge           badges%ROWTYPE;
  v_newly_earned    JSONB := '[]'::JSONB;
  v_active_pass     season_passes%ROWTYPE;
  v_pass_progress   season_pass_progress%ROWTYPE;
  v_new_tier_xp     INTEGER;
  v_new_season_tier INTEGER;
  v_game_level      TEXT;
BEGIN
  -- Fetch and lock submission
  SELECT * INTO v_submission FROM cut_submissions
  WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;
  IF v_submission.status != 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Submission is not pending');
  END IF;

  -- Lock profile row
  SELECT * INTO v_profile FROM profiles
  WHERE id = v_submission.customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Mark submission approved
  UPDATE cut_submissions SET
    status      = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = NOW()
  WHERE id = p_submission_id;

  -- Insert into cuts (no barber for customer-submitted cuts)
  INSERT INTO cuts (customer_id, barber_id, style, xp_earned, confirmed, created_at)
  VALUES (
    v_submission.customer_id,
    NULL,
    'Customer Submission',
    v_xp_earned,
    TRUE,
    v_submission.cut_date::TIMESTAMPTZ
  )
  RETURNING id INTO v_cut_id;

  -- Calculate new totals
  v_new_total_xp   := v_profile.total_xp + v_xp_earned;
  v_new_total_cuts := v_profile.total_cuts + 1;

  -- Streak logic (45-day window)
  IF v_profile.last_cut_date IS NOT NULL AND
     (CURRENT_DATE - v_profile.last_cut_date) <= 45 THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Spins: 1 per 5 cuts
  v_new_spins := v_profile.spins_available;
  IF v_new_total_cuts % 5 = 0 THEN
    v_new_spins := v_new_spins + 1;
  END IF;

  -- Membership tier
  IF v_new_total_cuts >= 30 THEN
    v_new_tier := 'platinum';
  ELSIF v_new_total_cuts >= 15 THEN
    v_new_tier := 'gold';
  ELSIF v_new_total_cuts >= 5 THEN
    v_new_tier := 'silver';
  ELSE
    v_new_tier := 'bronze';
  END IF;

  -- Game cuts + Hall of Fame check
  v_new_game_cuts := v_profile.game_cuts + 1;
  v_new_hof_count := v_profile.hall_of_fame_count;
  IF v_new_game_cuts >= 21 THEN
    v_hall_of_fame  := TRUE;
    v_new_hof_count := v_new_hof_count + 1;
    v_new_game_cuts := 0;  -- reset after beating the game
  END IF;

  -- Determine game level label (post-HOF reset)
  IF v_hall_of_fame THEN
    v_game_level := 'unranked';
  ELSIF v_new_game_cuts >= 19 THEN
    v_game_level := 'level3';
  ELSIF v_new_game_cuts >= 12 THEN
    v_game_level := 'level2';
  ELSIF v_new_game_cuts >= 5 THEN
    v_game_level := 'level1';
  ELSE
    v_game_level := 'unranked';
  END IF;

  -- Update profile (reset decay since they got a new cut)
  UPDATE profiles SET
    total_xp              = v_new_total_xp,
    total_cuts            = v_new_total_cuts,
    current_streak        = v_new_streak,
    longest_streak        = GREATEST(v_profile.longest_streak, v_new_streak),
    last_cut_date         = CURRENT_DATE,
    membership_tier       = v_new_tier,
    spins_available       = v_new_spins,
    game_cuts             = v_new_game_cuts,
    hall_of_fame_count    = v_new_hof_count,
    decay_periods_applied = 0
  WHERE id = v_submission.customer_id;

  -- Check and award badges
  FOR v_badge IN
    SELECT b.* FROM badges b
    WHERE b.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM earned_badges eb
      WHERE eb.customer_id = v_submission.customer_id AND eb.badge_id = b.id
    )
  LOOP
    DECLARE v_earned BOOLEAN := FALSE;
    BEGIN
      CASE v_badge.criteria_type
        WHEN 'cuts_count' THEN
          v_earned := v_new_total_cuts >= v_badge.criteria_value;
        WHEN 'streak' THEN
          v_earned := v_new_streak >= v_badge.criteria_value;
        WHEN 'referrals' THEN
          v_earned := (
            SELECT COUNT(*) FROM profiles WHERE referred_by = v_submission.customer_id
          ) >= v_badge.criteria_value;
        WHEN 'styles_tried' THEN
          v_earned := (
            SELECT COUNT(DISTINCT style) FROM cuts WHERE customer_id = v_submission.customer_id
          ) >= v_badge.criteria_value;
        ELSE
          v_earned := FALSE;
      END CASE;

      IF v_earned THEN
        INSERT INTO earned_badges (customer_id, badge_id)
        VALUES (v_submission.customer_id, v_badge.id)
        ON CONFLICT (customer_id, badge_id) DO NOTHING;

        v_newly_earned := v_newly_earned || jsonb_build_object(
          'id', v_badge.id,
          'name', v_badge.name,
          'icon', v_badge.icon
        );
      END IF;
    END;
  END LOOP;

  -- Update challenge progress
  DECLARE
    v_challenge challenges%ROWTYPE;
    v_progress  challenge_progress%ROWTYPE;
    v_new_val   INTEGER;
  BEGIN
    FOR v_challenge IN
      SELECT * FROM challenges
      WHERE is_active = TRUE AND now() BETWEEN starts_at AND ends_at
    LOOP
      INSERT INTO challenge_progress (customer_id, challenge_id, current_value)
      VALUES (v_submission.customer_id, v_challenge.id, 0)
      ON CONFLICT (customer_id, challenge_id) DO NOTHING;

      SELECT * INTO v_progress FROM challenge_progress
      WHERE customer_id = v_submission.customer_id AND challenge_id = v_challenge.id;

      IF v_progress.completed THEN CONTINUE; END IF;

      v_new_val := v_progress.current_value;

      CASE v_challenge.challenge_type
        WHEN 'cuts_in_period' THEN
          v_new_val := v_new_val + 1;
        ELSE NULL;
      END CASE;

      IF v_new_val >= v_challenge.target_value THEN
        UPDATE challenge_progress SET
          current_value = v_new_val,
          completed     = TRUE,
          completed_at  = NOW()
        WHERE customer_id = v_submission.customer_id AND challenge_id = v_challenge.id;

        UPDATE profiles SET total_xp = total_xp + v_challenge.reward_xp
        WHERE id = v_submission.customer_id;

        v_new_total_xp := v_new_total_xp + v_challenge.reward_xp;
      ELSE
        UPDATE challenge_progress SET current_value = v_new_val
        WHERE customer_id = v_submission.customer_id AND challenge_id = v_challenge.id;
      END IF;
    END LOOP;
  END;

  -- Update season pass progress
  SELECT * INTO v_active_pass FROM season_passes
  WHERE is_active = TRUE AND now() BETWEEN starts_at AND ends_at
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO season_pass_progress (customer_id, season_pass_id, current_tier, tier_xp)
    VALUES (v_submission.customer_id, v_active_pass.id, 0, 0)
    ON CONFLICT (customer_id, season_pass_id) DO NOTHING;

    SELECT * INTO v_pass_progress FROM season_pass_progress
    WHERE customer_id = v_submission.customer_id AND season_pass_id = v_active_pass.id;

    v_new_tier_xp     := v_pass_progress.tier_xp + v_xp_earned;
    v_new_season_tier := v_pass_progress.current_tier;

    WHILE v_new_tier_xp >= v_active_pass.xp_per_tier
      AND v_new_season_tier < v_active_pass.total_tiers
    LOOP
      v_new_tier_xp     := v_new_tier_xp - v_active_pass.xp_per_tier;
      v_new_season_tier := v_new_season_tier + 1;
    END LOOP;

    UPDATE season_pass_progress SET
      current_tier = v_new_season_tier,
      tier_xp      = v_new_tier_xp
    WHERE customer_id = v_submission.customer_id AND season_pass_id = v_active_pass.id;
  END IF;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'cut_id',             v_cut_id,
    'xp_earned',          v_xp_earned,
    'total_xp',           v_new_total_xp,
    'total_cuts',         v_new_total_cuts,
    'game_cuts',          v_new_game_cuts,
    'game_level',         v_game_level,
    'hall_of_fame',       v_hall_of_fame,
    'hall_of_fame_count', v_new_hof_count,
    'new_badges',         v_newly_earned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 8. RPC: reject_cut_submission ───────────────────────────────
CREATE OR REPLACE FUNCTION reject_cut_submission(
  p_submission_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE cut_submissions SET
    status           = 'rejected',
    rejection_reason = p_reason,
    reviewed_by      = p_admin_id,
    reviewed_at      = NOW()
  WHERE id = p_submission_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Submission not found or already reviewed');
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 9. RPC: apply_decay ─────────────────────────────────────────
-- Called on customer dashboard load. Idempotent — tracks applied
-- decay periods in decay_periods_applied to avoid double-deducting.
-- Grace period: 30 days. Then -1 game_cut per 14 days.
CREATE OR REPLACE FUNCTION apply_decay(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile              profiles%ROWTYPE;
  v_days_inactive        INTEGER;
  v_decay_periods_due    INTEGER;
  v_periods_to_apply     INTEGER := 0;
  v_new_game_cuts        INTEGER;
  v_next_decay_in_days   INTEGER;
  v_in_decay_window      BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  -- No last_cut_date means never had a cut — no decay
  IF v_profile.last_cut_date IS NULL THEN
    RETURN jsonb_build_object(
      'days_inactive',      NULL,
      'in_decay_window',    FALSE,
      'next_decay_in_days', NULL,
      'decay_applied',      0
    );
  END IF;

  v_days_inactive := (CURRENT_DATE - v_profile.last_cut_date)::INTEGER;

  IF v_days_inactive > 30 AND v_profile.game_cuts > 0 THEN
    -- Past grace period and has game cuts to lose
    v_in_decay_window   := TRUE;
    v_decay_periods_due := floor((v_days_inactive - 30)::NUMERIC / 14)::INTEGER;
    v_periods_to_apply  := GREATEST(0, v_decay_periods_due - v_profile.decay_periods_applied);

    IF v_periods_to_apply > 0 THEN
      v_new_game_cuts := GREATEST(0, v_profile.game_cuts - v_periods_to_apply);
      UPDATE profiles SET
        game_cuts             = v_new_game_cuts,
        decay_periods_applied = v_decay_periods_due
      WHERE id = p_customer_id;
    END IF;

    -- Days until the next decay tick
    v_next_decay_in_days := 14 - ((v_days_inactive - 30) % 14);

  ELSIF v_days_inactive > 20 THEN
    -- Warning window: past 20 days but still within 30-day grace
    v_in_decay_window    := TRUE;
    v_next_decay_in_days := 30 - v_days_inactive;

  ELSE
    v_in_decay_window    := FALSE;
    v_next_decay_in_days := NULL;
  END IF;

  RETURN jsonb_build_object(
    'days_inactive',      v_days_inactive,
    'in_decay_window',    v_in_decay_window,
    'next_decay_in_days', v_next_decay_in_days,
    'decay_applied',      v_periods_to_apply
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. RPC: admin_adjust_game_cuts ─────────────────────────────
CREATE OR REPLACE FUNCTION admin_adjust_game_cuts(
  p_customer_id   UUID,
  p_new_game_cuts INTEGER,
  p_admin_id      UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin_role TEXT;
  v_clamped    INTEGER;
BEGIN
  SELECT role INTO v_admin_role FROM profiles WHERE id = p_admin_id;
  IF v_admin_role NOT IN ('barber', 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Clamp between 0 and 20 (21 triggers HOF which is done via approval)
  v_clamped := GREATEST(0, LEAST(20, p_new_game_cuts));

  UPDATE profiles SET
    game_cuts             = v_clamped,
    decay_periods_applied = 0
  WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', TRUE, 'game_cuts', v_clamped);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 11. Update log_cut to also increment game_cuts ──────────────
-- Replaces the existing log_cut function with game system support.
CREATE OR REPLACE FUNCTION log_cut(
  p_customer_id UUID,
  p_barber_id   UUID,
  p_style       TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile         profiles%ROWTYPE;
  v_cut_id          UUID;
  v_xp_earned       INTEGER := 150;
  v_new_total_xp    INTEGER;
  v_new_total_cuts  INTEGER;
  v_new_streak      INTEGER;
  v_new_tier        TEXT;
  v_new_spins       INTEGER;
  v_new_game_cuts   INTEGER;
  v_new_hof_count   INTEGER;
  v_hall_of_fame    BOOLEAN := FALSE;
  v_badge           badges%ROWTYPE;
  v_newly_earned    JSONB := '[]'::JSONB;
  v_active_pass     season_passes%ROWTYPE;
  v_pass_progress   season_pass_progress%ROWTYPE;
  v_new_tier_xp     INTEGER;
  v_new_season_tier INTEGER;
BEGIN
  -- Lock the profile row to prevent race conditions
  SELECT * INTO v_profile FROM profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Insert the cut
  INSERT INTO cuts (customer_id, barber_id, style, xp_earned, confirmed)
  VALUES (p_customer_id, p_barber_id, p_style, v_xp_earned, TRUE)
  RETURNING id INTO v_cut_id;

  -- Calculate new totals
  v_new_total_xp   := v_profile.total_xp + v_xp_earned;
  v_new_total_cuts := v_profile.total_cuts + 1;

  -- Streak logic
  IF v_profile.last_cut_date IS NOT NULL AND
     (CURRENT_DATE - v_profile.last_cut_date) <= 45 THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Spins: 1 per 5 cuts
  v_new_spins := v_profile.spins_available;
  IF v_new_total_cuts % 5 = 0 THEN
    v_new_spins := v_new_spins + 1;
  END IF;

  -- Membership tier
  IF v_new_total_cuts >= 30 THEN
    v_new_tier := 'platinum';
  ELSIF v_new_total_cuts >= 15 THEN
    v_new_tier := 'gold';
  ELSIF v_new_total_cuts >= 5 THEN
    v_new_tier := 'silver';
  ELSE
    v_new_tier := 'bronze';
  END IF;

  -- Game cuts + Hall of Fame check
  v_new_game_cuts := v_profile.game_cuts + 1;
  v_new_hof_count := v_profile.hall_of_fame_count;
  IF v_new_game_cuts >= 21 THEN
    v_hall_of_fame  := TRUE;
    v_new_hof_count := v_new_hof_count + 1;
    v_new_game_cuts := 0;
  END IF;

  -- Update profile (reset decay since they got a new cut)
  UPDATE profiles SET
    total_xp              = v_new_total_xp,
    total_cuts            = v_new_total_cuts,
    current_streak        = v_new_streak,
    longest_streak        = GREATEST(v_profile.longest_streak, v_new_streak),
    last_cut_date         = CURRENT_DATE,
    membership_tier       = v_new_tier,
    spins_available       = v_new_spins,
    game_cuts             = v_new_game_cuts,
    hall_of_fame_count    = v_new_hof_count,
    decay_periods_applied = 0
  WHERE id = p_customer_id;

  -- Check and award badges
  FOR v_badge IN
    SELECT b.* FROM badges b
    WHERE b.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM earned_badges eb
      WHERE eb.customer_id = p_customer_id AND eb.badge_id = b.id
    )
  LOOP
    DECLARE v_earned BOOLEAN := FALSE;
    BEGIN
      CASE v_badge.criteria_type
        WHEN 'cuts_count' THEN
          v_earned := v_new_total_cuts >= v_badge.criteria_value;
        WHEN 'streak' THEN
          v_earned := v_new_streak >= v_badge.criteria_value;
        WHEN 'referrals' THEN
          v_earned := (
            SELECT COUNT(*) FROM profiles WHERE referred_by = p_customer_id
          ) >= v_badge.criteria_value;
        WHEN 'styles_tried' THEN
          v_earned := (
            SELECT COUNT(DISTINCT style) FROM cuts WHERE customer_id = p_customer_id
          ) >= v_badge.criteria_value;
        ELSE
          v_earned := FALSE;
      END CASE;

      IF v_earned THEN
        INSERT INTO earned_badges (customer_id, badge_id)
        VALUES (p_customer_id, v_badge.id)
        ON CONFLICT (customer_id, badge_id) DO NOTHING;

        v_newly_earned := v_newly_earned || jsonb_build_object(
          'id', v_badge.id,
          'name', v_badge.name,
          'icon', v_badge.icon
        );
      END IF;
    END;
  END LOOP;

  -- Update challenge progress
  DECLARE
    v_challenge challenges%ROWTYPE;
    v_progress  challenge_progress%ROWTYPE;
    v_new_val   INTEGER;
  BEGIN
    FOR v_challenge IN
      SELECT * FROM challenges
      WHERE is_active = TRUE
      AND now() BETWEEN starts_at AND ends_at
    LOOP
      INSERT INTO challenge_progress (customer_id, challenge_id, current_value)
      VALUES (p_customer_id, v_challenge.id, 0)
      ON CONFLICT (customer_id, challenge_id) DO NOTHING;

      SELECT * INTO v_progress FROM challenge_progress
      WHERE customer_id = p_customer_id AND challenge_id = v_challenge.id;

      IF v_progress.completed THEN CONTINUE; END IF;

      v_new_val := v_progress.current_value;

      CASE v_challenge.challenge_type
        WHEN 'cuts_in_period' THEN
          v_new_val := v_new_val + 1;
        WHEN 'try_new_style' THEN
          IF NOT EXISTS (
            SELECT 1 FROM cuts
            WHERE customer_id = p_customer_id AND style = p_style AND id != v_cut_id
          ) THEN
            v_new_val := v_new_val + 1;
          END IF;
        ELSE
          NULL;
      END CASE;

      IF v_new_val >= v_challenge.target_value THEN
        UPDATE challenge_progress SET
          current_value = v_new_val,
          completed     = TRUE,
          completed_at  = NOW()
        WHERE customer_id = p_customer_id AND challenge_id = v_challenge.id;

        UPDATE profiles SET total_xp = total_xp + v_challenge.reward_xp
        WHERE id = p_customer_id;

        v_new_total_xp := v_new_total_xp + v_challenge.reward_xp;
      ELSE
        UPDATE challenge_progress SET current_value = v_new_val
        WHERE customer_id = p_customer_id AND challenge_id = v_challenge.id;
      END IF;
    END LOOP;
  END;

  -- Update season pass progress
  SELECT * INTO v_active_pass FROM season_passes
  WHERE is_active = TRUE AND now() BETWEEN starts_at AND ends_at
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO season_pass_progress (customer_id, season_pass_id, current_tier, tier_xp)
    VALUES (p_customer_id, v_active_pass.id, 0, 0)
    ON CONFLICT (customer_id, season_pass_id) DO NOTHING;

    SELECT * INTO v_pass_progress FROM season_pass_progress
    WHERE customer_id = p_customer_id AND season_pass_id = v_active_pass.id;

    v_new_tier_xp     := v_pass_progress.tier_xp + v_xp_earned;
    v_new_season_tier := v_pass_progress.current_tier;

    WHILE v_new_tier_xp >= v_active_pass.xp_per_tier
      AND v_new_season_tier < v_active_pass.total_tiers
    LOOP
      v_new_tier_xp     := v_new_tier_xp - v_active_pass.xp_per_tier;
      v_new_season_tier := v_new_season_tier + 1;
    END LOOP;

    UPDATE season_pass_progress SET
      current_tier = v_new_season_tier,
      tier_xp      = v_new_tier_xp
    WHERE customer_id = p_customer_id AND season_pass_id = v_active_pass.id;
  END IF;

  RETURN jsonb_build_object(
    'cut_id',             v_cut_id,
    'xp_earned',          v_xp_earned,
    'total_xp',           v_new_total_xp,
    'total_cuts',         v_new_total_cuts,
    'streak',             v_new_streak,
    'tier',               v_new_tier,
    'spins',              v_new_spins,
    'new_badges',         v_newly_earned,
    'game_cuts',          v_new_game_cuts,
    'hall_of_fame',       v_hall_of_fame,
    'hall_of_fame_count', v_new_hof_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
