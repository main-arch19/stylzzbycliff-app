import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatXP,
  abbreviateNumber,
  calcProgress,
  getGameLevel,
  getGameLevelProgress,
  getDecayWarning,
  weightedRandom,
  formatReferralCode,
} from '../helpers'

const daysAgoISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe('formatXP', () => {
  it('formats XP, abbreviating thousands', () => {
    expect(formatXP(0)).toBe('0')
    expect(formatXP(undefined)).toBe('0')
    expect(formatXP(999)).toBe('999')
    expect(formatXP(1000)).toBe('1.0K')
    expect(formatXP(3200)).toBe('3.2K')
  })
})

describe('abbreviateNumber', () => {
  it('abbreviates thousands and millions', () => {
    expect(abbreviateNumber(500)).toBe('500')
    expect(abbreviateNumber(1500)).toBe('1.5K')
    expect(abbreviateNumber(2_000_000)).toBe('2.0M')
  })
})

describe('calcProgress', () => {
  it('returns a clamped 0-100 percentage', () => {
    expect(calcProgress(5, 10)).toBe(50)
    expect(calcProgress(10, 10)).toBe(100)
    expect(calcProgress(15, 10)).toBe(100) // clamped
    expect(calcProgress(0, 0)).toBe(100) // guard against divide-by-zero
  })
})

describe('getGameLevel', () => {
  it('maps game_cuts to the correct level', () => {
    expect(getGameLevel(0).id).toBe('unranked')
    expect(getGameLevel(4).id).toBe('unranked')
    expect(getGameLevel(5).id).toBe('level1')
    expect(getGameLevel(11).id).toBe('level1')
    expect(getGameLevel(12).id).toBe('level2')
    expect(getGameLevel(19).id).toBe('level3')
    expect(getGameLevel(20).id).toBe('level3')
  })
})

describe('getGameLevelProgress', () => {
  it('returns 0-100 progress within the current level', () => {
    expect(getGameLevelProgress(5)).toBe(0) // start of level1
    expect(getGameLevelProgress(8)).toBe(43) // (8-5)/(12-5) ≈ 43%
  })
})

describe('getDecayWarning', () => {
  it('returns null when there is no last-cut date', () => {
    expect(getDecayWarning(null)).toBeNull()
  })

  it('returns null while still inside the warning threshold', () => {
    expect(getDecayWarning(daysAgoISO(10))).toBeNull()
  })

  it('warns within the grace window with days until grace ends', () => {
    const warning = getDecayWarning(daysAgoISO(25))
    expect(warning).not.toBeNull()
    expect(warning.daysInactive).toBe(25)
    expect(warning.nextDecayInDays).toBe(5) // 30-day grace - 25
  })

  it('warns past grace with days until the next decay interval', () => {
    const warning = getDecayWarning(daysAgoISO(31))
    expect(warning.daysInactive).toBe(31)
    expect(warning.nextDecayInDays).toBe(13) // 14 - ((31-30) % 14)
  })
})

describe('weightedRandom', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the first prize when the roll is at the low end', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const prizes = [
      { id: 'a', weight: 70 },
      { id: 'b', weight: 30 },
    ]
    expect(weightedRandom(prizes).id).toBe('a')
  })

  it('returns a later prize when the roll lands in its band', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const prizes = [
      { id: 'a', weight: 70 },
      { id: 'b', weight: 30 },
    ]
    expect(weightedRandom(prizes).id).toBe('b')
  })
})

describe('formatReferralCode', () => {
  it('uppercases the code and handles empty input', () => {
    expect(formatReferralCode('abc123')).toBe('ABC123')
    expect(formatReferralCode('')).toBe('')
  })
})
