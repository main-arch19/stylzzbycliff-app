// ─── MOCK MODE ────────────────────────────────────────────────────
// Set to true to bypass Supabase and display example player data.
// Set back to false when ready to use real auth + database.
export const MOCK_MODE = true

// ─── Helpers ──────────────────────────────────────────────────────
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
const daysFromNow = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

// ─── Auth ─────────────────────────────────────────────────────────
export const MOCK_USER = {
  id: 'mock-000-000',
  email: 'demo@stylzzbycliff.com',
}

export const MOCK_PROFILE = {
  id: 'mock-000-000',
  username: 'CliffKing',
  full_name: 'Cliff King',
  total_cuts: 17,
  total_xp: 3200,
  current_streak: 4,
  membership_tier: 'gold',
  game_cuts: 14,
  hall_of_fame_count: 1,
  last_cut_date: daysAgo(5),
  role: 'customer',
  decay_periods_applied: 0,
  avatar_url: null,
}

// ─── Cuts ─────────────────────────────────────────────────────────
export const MOCK_CUTS = [
  { id: 'cut-1', customer_id: 'mock-000-000', created_at: daysAgo(5),  barbers: { name: 'Cliff', avatar_url: null } },
  { id: 'cut-2', customer_id: 'mock-000-000', created_at: daysAgo(19), barbers: { name: 'Cliff', avatar_url: null } },
  { id: 'cut-3', customer_id: 'mock-000-000', created_at: daysAgo(33), barbers: { name: 'Cliff', avatar_url: null } },
  { id: 'cut-4', customer_id: 'mock-000-000', created_at: daysAgo(47), barbers: { name: 'Cliff', avatar_url: null } },
  { id: 'cut-5', customer_id: 'mock-000-000', created_at: daysAgo(61), barbers: { name: 'Cliff', avatar_url: null } },
]

// ─── Challenges ───────────────────────────────────────────────────
export const MOCK_CHALLENGES = [
  {
    id: 'ch-1',
    title: 'Monthly Grind',
    description: 'Get 5 cuts this month and stack your XP.',
    goal_type: 'cuts',
    goal_value: 5,
    reward_xp: 250,
    is_active: true,
    starts_at: daysAgo(20),
    ends_at: daysFromNow(10),
  },
  {
    id: 'ch-2',
    title: 'Streak Builder',
    description: 'Maintain a streak of 4 cuts without skipping a week.',
    goal_type: 'streak',
    goal_value: 4,
    reward_xp: 400,
    is_active: true,
    starts_at: daysAgo(30),
    ends_at: daysFromNow(20),
  },
]

export const MOCK_CHALLENGE_PROGRESS = {
  'ch-1': { challenge_id: 'ch-1', current_value: 3, completed: false },
  'ch-2': { challenge_id: 'ch-2', current_value: 4, completed: true },
}

// ─── Rewards ──────────────────────────────────────────────────────
export const MOCK_REWARDS = [
  {
    id: 'rew-1',
    name: 'Free Beard Trim',
    description: 'On us. No cap.',
    cuts_required: 20,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'rew-2',
    name: '10% Off Next Cut',
    description: 'Loyalty discount applied at checkout.',
    cuts_required: 10,
    is_active: true,
    sort_order: 2,
  },
]

export const MOCK_CLAIMED_REWARDS = [
  {
    id: 'cr-1',
    customer_id: 'mock-000-000',
    reward_id: 'rew-2',
    redeemed: false,
    rewards: MOCK_REWARDS[1],
  },
]

// ─── Season Pass ──────────────────────────────────────────────────
export const MOCK_SEASON_PASS = {
  id: 'sp-1',
  name: 'Spring Season 2026',
  is_active: true,
  xp_per_tier: 500,
  ends_at: daysFromNow(45),
  created_at: daysAgo(30),
}

export const MOCK_SEASON_PASS_PROGRESS = {
  current_tier: 3,
  tier_xp: 320,
}

// ─── Leaderboard ──────────────────────────────────────────────────
export const MOCK_LEADERBOARD_RANK = 4

export const MOCK_LEADERBOARD = [
  { id: 'u-1', rank: 1, username: 'FadeGod',    total_xp: 8400, total_cuts: 56 },
  { id: 'u-2', rank: 2, username: 'SharpKing',  total_xp: 7100, total_cuts: 47 },
  { id: 'u-3', rank: 3, username: 'LowFadeRoy', total_xp: 5900, total_cuts: 39 },
  { id: 'mock-000-000', rank: 4, username: 'CliffKing', total_xp: 3200, total_cuts: 17 },
  { id: 'u-5', rank: 5, username: 'FreshTaper', total_xp: 2800, total_cuts: 14 },
]
