import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import { TIERS, SPIN_PRIZES, GAME_LEVELS, DECAY_GRACE_DAYS, DECAY_WARNING_THRESHOLD, DECAY_INTERVAL_DAYS } from './constants'

// ─── Date Helpers ──────────────────────────────────────────────────
export function formatRelativeDate(dateString) {
  if (!dateString) return ''
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  } catch {
    return dateString
  }
}

export function formatDate(dateString) {
  if (!dateString) return ''
  try {
    return format(new Date(dateString), 'MMM d, yyyy')
  } catch {
    return dateString
  }
}

export function daysUntil(dateString) {
  if (!dateString) return null
  try {
    const diff = differenceInDays(new Date(dateString), new Date())
    return diff
  } catch {
    return null
  }
}

export function timeUntil(dateString) {
  if (!dateString) return ''
  const days = daysUntil(dateString)
  if (days === null) return ''
  if (days < 0) return 'ENDED'
  if (days === 0) return 'TODAY'
  if (days === 1) return '1D LEFT'
  if (days < 7) return `${days}D LEFT`
  const weeks = Math.floor(days / 7)
  return `${weeks}W LEFT`
}

// ─── XP Formatting ────────────────────────────────────────────────
export function formatXP(xp) {
  if (!xp && xp !== 0) return '0'
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`
  return xp.toLocaleString()
}

// ─── Tier Helpers ──────────────────────────────────────────────────
export function getTierInfo(tier) {
  return TIERS[tier] || TIERS.bronze
}

export function getTierColor(tier) {
  return getTierInfo(tier).color
}

export function getTierLabel(tier) {
  return getTierInfo(tier).label
}

export function getTierBg(tier) {
  return getTierInfo(tier).bg
}

// ─── Avatar ────────────────────────────────────────────────────────
export function generateAvatarUrl(username, size = 64) {
  const seed = encodeURIComponent(username || 'user')
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}&size=${size}&backgroundColor=1e1e1e`
}

// ─── Spin Wheel ────────────────────────────────────────────────────
export function weightedRandom(prizes) {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0)
  let rand = Math.random() * totalWeight
  for (const prize of prizes) {
    rand -= prize.weight
    if (rand <= 0) return prize
  }
  return prizes[prizes.length - 1]
}

export function getPrizeByLabel(label) {
  return SPIN_PRIZES.find((p) => p.label === label) || SPIN_PRIZES[0]
}

export function getPrizeIndex(label) {
  const idx = SPIN_PRIZES.findIndex((p) => p.label === label)
  return idx >= 0 ? idx : 0
}

// ─── Progress Calculation ─────────────────────────────────────────
export function calcProgress(current, max) {
  if (!max || max === 0) return 100
  return Math.min(100, Math.round((current / max) * 100))
}

// ─── Referral Code ────────────────────────────────────────────────
export function formatReferralCode(code) {
  if (!code) return ''
  return code.toUpperCase()
}

// ─── Number Abbreviation ──────────────────────────────────────────
export function abbreviateNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

// ─── Toast Message Helpers ─────────────────────────────────────────
export function getCheckInSuccessMessage() {
  return "YOU'RE LOCKED IN → +50 XP"
}

export function getCutLoggedMessage(username, xp) {
  return `Cut logged. ${username} just earned ${xp} XP 🔥`
}

export function getErrorMessage() {
  return 'Something went wrong, King. Try again.'
}

export function getStreakMessage(streak) {
  return `That's ${streak} in a row. You're on fire 🔥`
}

// ─── Game Level Helpers ────────────────────────────────────────────
export function getGameLevel(gameCuts) {
  for (let i = GAME_LEVELS.length - 1; i >= 0; i--) {
    if (gameCuts >= GAME_LEVELS[i].minCuts) return GAME_LEVELS[i]
  }
  return GAME_LEVELS[0]
}

// Returns 0–100 progress within the current level toward the next threshold
export function getGameLevelProgress(gameCuts) {
  const level = getGameLevel(gameCuts)
  if (!level.nextAt) return 100
  const rangeStart = level.minCuts
  const rangeEnd   = level.nextAt
  return Math.min(100, Math.round(((gameCuts - rangeStart) / (rangeEnd - rangeStart)) * 100))
}

// Returns warning info if inactive >= threshold, otherwise null
export function getDecayWarning(lastCutDate) {
  if (!lastCutDate) return null
  try {
    const days = differenceInDays(new Date(), new Date(lastCutDate))
    if (days < DECAY_WARNING_THRESHOLD) return null
    let nextDecayInDays
    if (days > DECAY_GRACE_DAYS) {
      nextDecayInDays = DECAY_INTERVAL_DAYS - ((days - DECAY_GRACE_DAYS) % DECAY_INTERVAL_DAYS)
    } else {
      nextDecayInDays = DECAY_GRACE_DAYS - days
    }
    return { daysInactive: days, nextDecayInDays }
  } catch {
    return null
  }
}
