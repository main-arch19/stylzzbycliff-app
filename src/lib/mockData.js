// ─── MOCK MODE ────────────────────────────────────────────────────
// Bypasses Supabase and displays example player data. ON when
// VITE_MOCK_MODE=true, OR automatically when no Supabase credentials are
// configured — so a fresh deploy (e.g. Vercel without env vars) shows the
// preview instead of a blank screen. Add VITE_SUPABASE_URL +
// VITE_SUPABASE_ANON_KEY to switch to a real backend.
const hasSupabaseCreds = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)
export const MOCK_MODE =
  import.meta.env.VITE_MOCK_MODE === 'true' || !hasSupabaseCreds

// Loud signal so an unconfigured deploy is never mistaken for a live backend.
if (MOCK_MODE && import.meta.env.VITE_MOCK_MODE !== 'true') {
  console.warn(
    '[StylzzByCliff] Running in MOCK/preview mode — no Supabase credentials found. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect a real backend.',
  )
}

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
const hoursFromNow = (n) => {
  const d = new Date()
  d.setHours(d.getHours() + n)
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
  style_dna_haircut: 'Skin Fade',
  style_dna_beard: 'Full Beard',
}

// ─── Style DNA breakdown (cut-history analytics) ──────────────────
export const MOCK_STYLE_DNA = {
  styles: [
    { style: 'Skin Fade',  count: 8, percentage: 47 },
    { style: 'Taper Fade', count: 5, percentage: 29 },
    { style: 'Line Up',    count: 3, percentage: 18 },
    { style: 'Buzz Cut',   count: 1, percentage: 6 },
  ],
  total: 17,
  unique_styles: 4,
  favorite_barber: 'Cliff',
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

// ─── Services (bookable catalog) ──────────────────────────────────
export const MOCK_SERVICES = [
  { id: 'svc-1', name: 'Skin Fade',    duration_min: 30, price_cents: 3500, deposit_cents: 1000, is_active: true, sort_order: 1 },
  { id: 'svc-2', name: 'Fade + Beard', duration_min: 45, price_cents: 4500, deposit_cents: 1500, is_active: true, sort_order: 2 },
  { id: 'svc-3', name: 'Line Up',      duration_min: 15, price_cents: 1500, deposit_cents: 0,    is_active: true, sort_order: 3 },
]

// ─── Appointments (fed in from the external calendar) ─────────────
// Matched rows belong to the mock user; the last row is unmatched
// (no account with that email) to exercise the admin queue.
export const MOCK_APPOINTMENTS = [
  {
    id: 'appt-1', customer_id: 'mock-000-000', customer_email: 'demo@stylzzbycliff.com',
    customer_name: 'Cliff King', barber_id: 'barber-1', barbers: { name: 'Cliff' },
    service_name: 'Skin Fade', starts_at: hoursFromNow(26), ends_at: hoursFromNow(26.5),
    status: 'confirmed', source: 'website', external_ref: 'cal_1', cut_id: null,
    created_at: hoursFromNow(-3),
  },
  {
    id: 'appt-2', customer_id: 'mock-000-000', customer_email: 'demo@stylzzbycliff.com',
    customer_name: 'Cliff King', barber_id: 'barber-1', barbers: { name: 'Cliff' },
    service_name: 'Fade + Beard', starts_at: daysFromNow(6), ends_at: daysFromNow(6),
    status: 'confirmed', source: 'website', external_ref: 'cal_2', cut_id: null,
    created_at: daysAgo(1),
  },
  {
    id: 'appt-3', customer_id: 'mock-000-000', customer_email: 'demo@stylzzbycliff.com',
    customer_name: 'Cliff King', barber_id: 'barber-1', barbers: { name: 'Cliff' },
    service_name: 'Skin Fade', starts_at: daysAgo(5), ends_at: daysAgo(5),
    status: 'completed', source: 'website', external_ref: 'cal_0', cut_id: 'cut-1',
    created_at: daysAgo(6),
  },
  {
    id: 'appt-9', customer_id: null, customer_email: 'newguy@example.com',
    customer_name: 'New Guy', barber_id: 'barber-1', barbers: { name: 'Cliff' },
    service_name: 'Line Up', starts_at: hoursFromNow(30), ends_at: hoursFromNow(30.5),
    status: 'confirmed', source: 'website', external_ref: 'cal_9', cut_id: null,
    created_at: hoursFromNow(-1),
  },
]

// ─── Barber dashboard aggregates ──────────────────────────────────
export const MOCK_DASHBOARD = {
  appointments_today: 3,
  next_appointment: { starts_at: hoursFromNow(2), customer_name: 'Cliff King', service_name: 'Skin Fade' },
  cuts_today: 2,
  cuts_week: 11,
  tips_today_cents: 1500,
  tips_week_cents: 8200,
  pending_approvals: 2,
  pending_redemptions: 1,
  decay_risk: 3,
  unmatched_bookings: 1,
  website_bookings_upcoming: 2,
  new_customers_week: 4,
}
