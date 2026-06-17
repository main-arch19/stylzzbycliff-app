// ─── Membership Tiers ────────────────────────────────────────────
export const TIERS = {
  bronze: {
    label: 'BRONZE',
    minCuts: 0,
    maxCuts: 4,
    color: '#B4783C',
    bg: 'rgba(180,120,60,0.2)',
    cssClass: 'tier-bronze',
  },
  silver: {
    label: 'SILVER',
    minCuts: 5,
    maxCuts: 14,
    color: '#AAAAAA',
    bg: 'rgba(180,180,180,0.2)',
    cssClass: 'tier-silver',
  },
  gold: {
    label: 'GOLD',
    minCuts: 15,
    maxCuts: 29,
    color: '#D4A03C',
    bg: 'rgba(212,160,60,0.2)',
    cssClass: 'tier-gold',
  },
  platinum: {
    label: 'PLATINUM',
    minCuts: 30,
    maxCuts: Infinity,
    color: '#A0C8FF',
    bg: 'rgba(160,200,255,0.2)',
    cssClass: 'tier-platinum',
  },
}

export function getTierForCuts(cuts) {
  if (cuts >= 30) return 'platinum'
  if (cuts >= 15) return 'gold'
  if (cuts >= 5) return 'silver'
  return 'bronze'
}

export function getNextTier(currentTier) {
  const order = ['bronze', 'silver', 'gold', 'platinum']
  const idx = order.indexOf(currentTier)
  return idx < order.length - 1 ? order[idx + 1] : null
}

export function getCutsToNextTier(currentCuts) {
  if (currentCuts >= 30) return 0
  if (currentCuts >= 15) return 30 - currentCuts
  if (currentCuts >= 5) return 15 - currentCuts
  return 5 - currentCuts
}

// ─── XP Values ────────────────────────────────────────────────────
export const XP = {
  CUT_BASE: 150,
  CHECK_IN: 50,
  REFERRAL_REFERRER: 200,
  REFERRAL_NEW: 100,
}

// ─── Spin Prize Pool ──────────────────────────────────────────────
// Weights sum to 100 for easy probability calculation
export const SPIN_PRIZES = [
  { id: 'xp_50', label: '50 XP BONUS', type: 'xp', value: 50, weight: 35, color: '#C0392B' },
  { id: 'xp_100', label: '100 XP BONUS', type: 'xp', value: 100, weight: 25, color: '#E74C3C' },
  { id: 'beard_trim', label: 'FREE BEARD TRIM', type: 'service', value: 0, weight: 15, color: '#D4A03C' },
  { id: 'double_xp', label: 'DOUBLE XP', type: 'multiplier', value: 2, weight: 12, color: '#27AE60' },
  { id: 'xp_200', label: '200 XP BONUS', type: 'xp', value: 200, weight: 8, color: '#E67E22' },
  { id: 'free_cut', label: 'FREE HAIRCUT', type: 'service', value: 0, weight: 5, color: '#A0C8FF' },
]

// ─── Common Haircut Styles ────────────────────────────────────────
export const HAIRCUT_STYLES = [
  'Classic Fade',
  'Skin Fade',
  'Mid Fade',
  'High Fade',
  'Taper Fade',
  'Caesar Cut',
  'Buzz Cut',
  'Line Up',
  'Temp Fade',
  'Drop Fade',
  'Blowout',
  'Mohawk Fade',
  'Textured Crop',
  'French Crop',
  'Comb Over',
  'Afro',
  'Dreads Maintenance',
  'Braids',
  'Waves',
  'Custom Style',
]

// ─── Common Beard Styles ──────────────────────────────────────────
export const BEARD_STYLES = [
  'Clean Shave',
  'Stubble',
  'Short Beard',
  'Full Beard',
  'Goatee',
  'Van Dyke',
  'Beard Fade',
  'Mustache',
  'Chin Strap',
  'Anchor',
  'Circle Beard',
  'Ducktail',
]

// ─── Brand Colors ─────────────────────────────────────────────────
export const COLORS = {
  clipperRed: '#C0392B',
  goldBlade: '#D4A03C',
  midnight: '#111111',
  charcoal: '#1E1E1E',
  cream: '#F2EFEA',
  warmGrey: '#6B6560',
  success: '#27AE60',
  warning: '#E67E22',
  error: '#E74C3C',
}

// ─── Streak Logic ─────────────────────────────────────────────────
export const STREAK_WINDOW_DAYS = 45

// ─── Cuts per spin ────────────────────────────────────────────────
export const CUTS_PER_SPIN = 5

// ─── Game Levels ──────────────────────────────────────────────────
// game_cuts cycles 0–20 then resets to 0 at Hall of Fame (21)
export const GAME_LEVELS = [
  {
    id:      'unranked',
    name:    'Unranked',
    minCuts: 0,
    maxCuts: 4,
    nextAt:  5,
    color:   '#6B6560',
    bg:      'rgba(107,101,96,0.2)',
    icon:    '—',
    description: 'Get 5 cuts to enter the game.',
  },
  {
    id:      'level1',
    name:    'Fresh Fade',
    minCuts: 5,
    maxCuts: 11,
    nextAt:  12,
    color:   '#AAAAAA',
    bg:      'rgba(170,170,170,0.2)',
    icon:    '✂️',
    description: "You're in the game.",
  },
  {
    id:      'level2',
    name:    'Sharp Regular',
    minCuts: 12,
    maxCuts: 18,
    nextAt:  19,
    color:   '#D4A03C',
    bg:      'rgba(212,160,60,0.2)',
    icon:    '💈',
    description: "You're a recognized regular.",
  },
  {
    id:      'level3',
    name:    'Legendary',
    minCuts: 19,
    maxCuts: 20,
    nextAt:  21,
    color:   '#C0392B',
    bg:      'rgba(192,57,43,0.2)',
    icon:    '👑',
    description: 'Elite status.',
  },
]

// Hall of Fame is triggered at exactly 21 game_cuts, then resets
export const GAME_HOF_AT = 21

// ─── Decay System ─────────────────────────────────────────────────
export const DECAY_GRACE_DAYS        = 30   // no penalty for first 30 days
export const DECAY_INTERVAL_DAYS     = 14   // -1 game_cut every 14 days after grace
export const DECAY_WARNING_THRESHOLD = 20   // show warning after 20 days inactive
