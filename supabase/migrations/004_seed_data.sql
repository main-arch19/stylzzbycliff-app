-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 004: Seed Data
-- ════════════════════════════════════════════════════════════════

-- ─── Barbers ──────────────────────────────────────────────────────
INSERT INTO barbers (id, name, specialty, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cliff', 'Master Barber · Fades & Line-Ups', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── Milestone Rewards ────────────────────────────────────────────
INSERT INTO rewards (name, description, icon, cuts_required, xp_bonus, sort_order) VALUES
  ('Free Beard Trim',   'A fresh beard trim on us. Stay groomed, King.',              '✂️',  5,  100, 1),
  ('Free Haircut',      'Your next cut is on the house. You earned it.',              '💈', 10,  200, 2),
  ('Hot Towel + Cut',   'The full treatment — hot towel, cut, fresh finish.',         '🔥', 15,  300, 3),
  ('VIP Package',       'Priority booking + complimentary style consultation.',        '⭐', 20,  400, 4),
  ('Free Month Pass',   'Unlimited cuts for a whole month. Welcome to the top.',       '👑', 30, 1000, 5)
ON CONFLICT DO NOTHING;

-- ─── Badges ───────────────────────────────────────────────────────
INSERT INTO badges (name, description, icon, criteria_type, criteria_value) VALUES
  ('First Cut',      'You walked in and got right. Welcome to the fam.',           '✂️',  'cuts_count',   1),
  ('Regular',        'Five cuts deep. You''re a regular now. Respect.',            '💈',  'cuts_count',   5),
  ('Loyal King',     'Ten cuts and still counting. True loyalty right here.',      '👑',  'cuts_count',  10),
  ('Streak Lord',    'Seven visits in a row. You never miss.',                     '🔥',  'streak',       7),
  ('Style Shifter',  'Tried 5 different styles. You keep it versatile.',           '🎨',  'styles_tried', 5),
  ('Crew Captain',   'Referred 3 people to the shop. Squad leader status.',        '🤝',  'referrals',    3)
ON CONFLICT DO NOTHING;

-- ─── Active Challenges ────────────────────────────────────────────
INSERT INTO challenges (name, description, challenge_type, target_value, reward_description, reward_xp, starts_at, ends_at) VALUES
  (
    'Spring Grind',
    'Get 3 cuts this month and level up your look for the season.',
    'cuts_in_period',
    3,
    '+500 XP + Spring Grind Badge',
    500,
    '2026-03-01 00:00:00+00',
    '2026-04-30 23:59:59+00'
  ),
  (
    'Style Explorer',
    'Try 2 different styles this week. Switch it up, King.',
    'try_new_style',
    2,
    '+300 XP',
    300,
    '2026-03-24 00:00:00+00',
    '2026-04-06 23:59:59+00'
  ),
  (
    'Check-In Champion',
    'Check in at the shop 5 times this month.',
    'check_in',
    5,
    '+250 XP',
    250,
    '2026-03-01 00:00:00+00',
    '2026-03-31 23:59:59+00'
  )
ON CONFLICT DO NOTHING;

-- ─── Spring 2026 Season Pass ──────────────────────────────────────
INSERT INTO season_passes (name, total_tiers, xp_per_tier, starts_at, ends_at, is_active) VALUES
  (
    'SPRING 2026 PASS',
    10,
    500,
    '2026-03-01 00:00:00+00',
    '2026-05-31 23:59:59+00',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ─── Demo Customer ────────────────────────────────────────────────
-- NOTE: The demo user must be created via Supabase Auth first.
-- After creating auth user with email demo@stylzzbycliff.com,
-- run the UPDATE below to set the correct profile data.
-- The trigger will auto-create the profile; this just patches the demo data.

-- If you want to manually set up demo data after auth user creation,
-- run this (replace the UUID with the actual auth user id):
--
-- UPDATE profiles SET
--   username        = 'freshking',
--   full_name       = 'Demo Customer',
--   total_xp        = 1050,
--   total_cuts      = 7,
--   current_streak  = 3,
--   longest_streak  = 5,
--   last_cut_date   = CURRENT_DATE - 10,
--   membership_tier = 'silver',
--   spins_available = 1
-- WHERE id = '<demo-user-uuid>';
--
-- Then log 7 cuts for that user:
-- SELECT log_cut('<demo-user-uuid>', '00000000-0000-0000-0000-000000000001', 'Classic Fade');
-- (repeat with different styles)

-- ─── Instructions ─────────────────────────────────────────────────
-- To complete setup:
-- 1. Apply all 4 migrations to your Supabase project via the SQL editor
-- 2. Create a user in Supabase Auth: demo@stylzzbycliff.com / Demo1234!
--    with metadata: { "username": "freshking" }
-- 3. The trigger will auto-create the profile
-- 4. Run the UPDATE above with the correct UUID to set demo stats
-- 5. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
