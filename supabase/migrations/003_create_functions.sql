-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 003: Database Functions (RPC)
-- All functions use SECURITY DEFINER so they can bypass RLS
-- and perform atomic multi-table operations.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- log_cut: The core function — logs a cut and runs all side effects
-- ════════════════════════════════════════════════════════════════
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

  -- ── Insert the cut ──────────────────────────────────────────────
  INSERT INTO cuts (customer_id, barber_id, style, xp_earned, confirmed)
  VALUES (p_customer_id, p_barber_id, p_style, v_xp_earned, TRUE)
  RETURNING id INTO v_cut_id;

  -- ── Calculate new totals ────────────────────────────────────────
  v_new_total_xp   := v_profile.total_xp + v_xp_earned;
  v_new_total_cuts := v_profile.total_cuts + 1;

  -- ── Streak logic ────────────────────────────────────────────────
  -- Streak continues if last cut was within 45 days, else reset to 1
  IF v_profile.last_cut_date IS NOT NULL AND
     (CURRENT_DATE - v_profile.last_cut_date) <= 45 THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- ── Spins: 1 spin every 5 cuts ──────────────────────────────────
  v_new_spins := v_profile.spins_available;
  IF v_new_total_cuts % 5 = 0 THEN
    v_new_spins := v_new_spins + 1;
  END IF;

  -- ── Membership tier ─────────────────────────────────────────────
  IF v_new_total_cuts >= 30 THEN
    v_new_tier := 'platinum';
  ELSIF v_new_total_cuts >= 15 THEN
    v_new_tier := 'gold';
  ELSIF v_new_total_cuts >= 5 THEN
    v_new_tier := 'silver';
  ELSE
    v_new_tier := 'bronze';
  END IF;

  -- ── Update profile ──────────────────────────────────────────────
  UPDATE profiles SET
    total_xp        = v_new_total_xp,
    total_cuts      = v_new_total_cuts,
    current_streak  = v_new_streak,
    longest_streak  = GREATEST(v_profile.longest_streak, v_new_streak),
    last_cut_date   = CURRENT_DATE,
    membership_tier = v_new_tier,
    spins_available = v_new_spins
  WHERE id = p_customer_id;

  -- ── Check and award badges ──────────────────────────────────────
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

  -- ── Update challenge progress ───────────────────────────────────
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
      -- Upsert progress row
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
          -- increment if this style is new for the customer
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
        -- Complete the challenge and award XP
        UPDATE challenge_progress SET
          current_value = v_new_val,
          completed = TRUE,
          completed_at = NOW()
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

  -- ── Update season pass progress ─────────────────────────────────
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

  -- ── Return result ───────────────────────────────────────────────
  RETURN jsonb_build_object(
    'cut_id',        v_cut_id,
    'xp_earned',     v_xp_earned,
    'total_xp',      v_new_total_xp,
    'total_cuts',    v_new_total_cuts,
    'streak',        v_new_streak,
    'tier',          v_new_tier,
    'spins',         v_new_spins,
    'new_badges',    v_newly_earned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- perform_spin
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION perform_spin(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile  profiles%ROWTYPE;
  v_prizes   TEXT[] := ARRAY[
    '50 XP BONUS','50 XP BONUS','50 XP BONUS','50 XP BONUS','50 XP BONUS',
    '50 XP BONUS','50 XP BONUS',
    '100 XP BONUS','100 XP BONUS','100 XP BONUS','100 XP BONUS','100 XP BONUS',
    'FREE BEARD TRIM','FREE BEARD TRIM','FREE BEARD TRIM',
    'DOUBLE XP','DOUBLE XP','DOUBLE XP',
    '200 XP BONUS','200 XP BONUS',
    'FREE HAIRCUT'
  ];
  v_prize    TEXT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_profile.spins_available <= 0 THEN RAISE EXCEPTION 'No spins available'; END IF;

  -- Pick random prize (weighted via array size)
  v_prize := v_prizes[1 + floor(random() * array_length(v_prizes, 1))::int];

  -- Award XP prizes immediately
  IF v_prize = '50 XP BONUS' THEN
    UPDATE profiles SET total_xp = total_xp + 50, spins_available = spins_available - 1 WHERE id = p_customer_id;
  ELSIF v_prize = '100 XP BONUS' THEN
    UPDATE profiles SET total_xp = total_xp + 100, spins_available = spins_available - 1 WHERE id = p_customer_id;
  ELSIF v_prize = '200 XP BONUS' THEN
    UPDATE profiles SET total_xp = total_xp + 200, spins_available = spins_available - 1 WHERE id = p_customer_id;
  ELSE
    UPDATE profiles SET spins_available = spins_available - 1 WHERE id = p_customer_id;
  END IF;

  INSERT INTO spin_results (customer_id, prize, redeemed)
  VALUES (p_customer_id, v_prize, FALSE);

  RETURN jsonb_build_object('prize', v_prize);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- daily_check_in
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION daily_check_in(p_customer_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- The UNIQUE constraint on (customer_id, created_at::DATE) handles idempotency
  BEGIN
    INSERT INTO check_ins (customer_id, xp_earned)
    VALUES (p_customer_id, 50);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Already checked in today');
  END;

  UPDATE profiles SET total_xp = total_xp + 50 WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', TRUE, 'xp_earned', 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- claim_reward
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION claim_reward(p_customer_id UUID, p_reward_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_reward   rewards%ROWTYPE;
  v_profile  profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  IF v_profile.total_cuts < v_reward.cuts_required THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Not enough cuts');
  END IF;

  IF EXISTS (
    SELECT 1 FROM claimed_rewards
    WHERE customer_id = p_customer_id AND reward_id = p_reward_id AND redeemed = FALSE
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Already claimed');
  END IF;

  INSERT INTO claimed_rewards (customer_id, reward_id)
  VALUES (p_customer_id, p_reward_id);

  RETURN jsonb_build_object('success', TRUE, 'reward', v_reward.name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- use_referral_code
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION use_referral_code(
  p_new_customer_id UUID,
  p_referral_code   TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT id INTO v_referrer_id FROM profiles
  WHERE referral_code = UPPER(p_referral_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_new_customer_id THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Cannot use your own referral code');
  END IF;

  -- Set referred_by on new customer
  UPDATE profiles SET referred_by = v_referrer_id WHERE id = p_new_customer_id;

  -- Award XP to referrer (+200) and new customer (+100)
  UPDATE profiles SET total_xp = total_xp + 200 WHERE id = v_referrer_id;
  UPDATE profiles SET total_xp = total_xp + 100 WHERE id = p_new_customer_id;

  RETURN jsonb_build_object('success', TRUE, 'referrer_id', v_referrer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════
-- get_leaderboard
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  rank            BIGINT,
  id              UUID,
  username        TEXT,
  avatar_url      TEXT,
  total_xp        INTEGER,
  current_streak  INTEGER,
  membership_tier TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_xp DESC) AS rank,
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    p.current_streak,
    p.membership_tier
  FROM profiles p
  WHERE p.role = 'customer'
  ORDER BY p.total_xp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════
-- get_style_dna
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_style_dna(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total        INTEGER;
  v_styles       JSONB;
  v_fav_barber   TEXT;
  v_unique_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM cuts WHERE customer_id = p_customer_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('styles', '[]'::JSONB, 'total', 0, 'unique_styles', 0);
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'style', style,
      'count', cnt,
      'percentage', ROUND((cnt::NUMERIC / v_total) * 100)
    ) ORDER BY cnt DESC
  ) INTO v_styles
  FROM (
    SELECT style, COUNT(*) AS cnt
    FROM cuts
    WHERE customer_id = p_customer_id
    GROUP BY style
    ORDER BY cnt DESC
    LIMIT 6
  ) s;

  SELECT b.name INTO v_fav_barber
  FROM cuts c
  JOIN barbers b ON b.id = c.barber_id
  WHERE c.customer_id = p_customer_id
  GROUP BY b.id, b.name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT COUNT(DISTINCT style) INTO v_unique_count FROM cuts WHERE customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'styles', COALESCE(v_styles, '[]'::JSONB),
    'total', v_total,
    'unique_styles', v_unique_count,
    'favorite_barber', v_fav_barber
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
