-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 002: Row-Level Security Policies
-- ════════════════════════════════════════════════════════════════

-- ─── Helper function to get current user's role ───────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Own profile: full read/update
CREATE POLICY "profiles: own read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Leaderboard: all users can read limited columns of all profiles
-- (enforced at query level by selecting only allowed columns)
CREATE POLICY "profiles: leaderboard read"
  ON profiles FOR SELECT
  USING (true);

-- Admin: full access
CREATE POLICY "profiles: admin all"
  ON profiles FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- barbers
-- ════════════════════════════════════════════════════════════════
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read barbers
CREATE POLICY "barbers: read all"
  ON barbers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Barbers and admins can insert/update/delete
CREATE POLICY "barbers: barber manage"
  ON barbers FOR ALL
  USING (get_my_role() IN ('barber','admin'));

-- ════════════════════════════════════════════════════════════════
-- cuts
-- ════════════════════════════════════════════════════════════════
ALTER TABLE cuts ENABLE ROW LEVEL SECURITY;

-- Customers can read their own cuts
CREATE POLICY "cuts: own read"
  ON cuts FOR SELECT
  USING (auth.uid() = customer_id);

-- Barbers can read all cuts (to confirm)
CREATE POLICY "cuts: barber read all"
  ON cuts FOR SELECT
  USING (get_my_role() IN ('barber','admin'));

-- Barbers can insert and update (confirm) cuts
CREATE POLICY "cuts: barber insert"
  ON cuts FOR INSERT
  WITH CHECK (get_my_role() IN ('barber','admin'));

CREATE POLICY "cuts: barber update"
  ON cuts FOR UPDATE
  USING (get_my_role() IN ('barber','admin'));

-- Admin full
CREATE POLICY "cuts: admin all"
  ON cuts FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- rewards
-- ════════════════════════════════════════════════════════════════
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Public catalog: all authenticated can read active rewards
CREATE POLICY "rewards: public read"
  ON rewards FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Admin full CRUD
CREATE POLICY "rewards: admin all"
  ON rewards FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- claimed_rewards
-- ════════════════════════════════════════════════════════════════
ALTER TABLE claimed_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claimed_rewards: own read"
  ON claimed_rewards FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "claimed_rewards: own insert"
  ON claimed_rewards FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Barbers/admins can read and update (mark redeemed)
CREATE POLICY "claimed_rewards: barber read"
  ON claimed_rewards FOR SELECT
  USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "claimed_rewards: barber update"
  ON claimed_rewards FOR UPDATE
  USING (get_my_role() IN ('barber','admin'));

CREATE POLICY "claimed_rewards: admin all"
  ON claimed_rewards FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- badges
-- ════════════════════════════════════════════════════════════════
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges: public read"
  ON badges FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "badges: admin all"
  ON badges FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- earned_badges
-- ════════════════════════════════════════════════════════════════
ALTER TABLE earned_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "earned_badges: own read"
  ON earned_badges FOR SELECT
  USING (auth.uid() = customer_id);

-- System inserts via SECURITY DEFINER functions
CREATE POLICY "earned_badges: admin all"
  ON earned_badges FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- challenges
-- ════════════════════════════════════════════════════════════════
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges: public read"
  ON challenges FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE AND now() BETWEEN starts_at AND ends_at);

CREATE POLICY "challenges: admin all"
  ON challenges FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- challenge_progress
-- ════════════════════════════════════════════════════════════════
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_progress: own read"
  ON challenge_progress FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "challenge_progress: admin all"
  ON challenge_progress FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- check_ins
-- ════════════════════════════════════════════════════════════════
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_ins: own read"
  ON check_ins FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "check_ins: own insert"
  ON check_ins FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "check_ins: admin all"
  ON check_ins FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- spin_results
-- ════════════════════════════════════════════════════════════════
ALTER TABLE spin_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spin_results: own read"
  ON spin_results FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "spin_results: own insert"
  ON spin_results FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "spin_results: admin all"
  ON spin_results FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- crews
-- ════════════════════════════════════════════════════════════════
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

-- Members can read their crew
CREATE POLICY "crews: member read"
  ON crews FOR SELECT
  USING (
    auth.uid() = captain_id OR
    EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = crews.id AND member_id = auth.uid()
    )
  );

-- Customers can create a crew
CREATE POLICY "crews: customer insert"
  ON crews FOR INSERT
  WITH CHECK (auth.uid() = captain_id);

-- Captain can update/delete
CREATE POLICY "crews: captain manage"
  ON crews FOR UPDATE
  USING (auth.uid() = captain_id);

CREATE POLICY "crews: captain delete"
  ON crews FOR DELETE
  USING (auth.uid() = captain_id);

CREATE POLICY "crews: admin all"
  ON crews FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- crew_members
-- ════════════════════════════════════════════════════════════════
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crew_members: member read"
  ON crew_members FOR SELECT
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM crews WHERE id = crew_id AND captain_id = auth.uid()
    )
  );

-- Captain can add/remove members
CREATE POLICY "crew_members: captain insert"
  ON crew_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crews WHERE id = crew_id AND captain_id = auth.uid()
    )
  );

CREATE POLICY "crew_members: captain delete"
  ON crew_members FOR DELETE
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM crews WHERE id = crew_id AND captain_id = auth.uid()
    )
  );

CREATE POLICY "crew_members: admin all"
  ON crew_members FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- season_passes
-- ════════════════════════════════════════════════════════════════
ALTER TABLE season_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "season_passes: public read"
  ON season_passes FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "season_passes: admin all"
  ON season_passes FOR ALL
  USING (get_my_role() = 'admin');

-- ════════════════════════════════════════════════════════════════
-- season_pass_progress
-- ════════════════════════════════════════════════════════════════
ALTER TABLE season_pass_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "season_pass_progress: own read"
  ON season_pass_progress FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "season_pass_progress: admin all"
  ON season_pass_progress FOR ALL
  USING (get_my_role() = 'admin');
