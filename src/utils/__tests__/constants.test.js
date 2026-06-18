import { describe, it, expect } from 'vitest'
import {
  getTierForCuts,
  getNextTier,
  getCutsToNextTier,
  SPIN_PRIZES,
  GAME_LEVELS,
  GAME_HOF_AT,
} from '../constants'

describe('getTierForCuts', () => {
  it('maps cut counts to the right membership tier at every boundary', () => {
    expect(getTierForCuts(0)).toBe('bronze')
    expect(getTierForCuts(4)).toBe('bronze')
    expect(getTierForCuts(5)).toBe('silver')
    expect(getTierForCuts(14)).toBe('silver')
    expect(getTierForCuts(15)).toBe('gold')
    expect(getTierForCuts(29)).toBe('gold')
    expect(getTierForCuts(30)).toBe('platinum')
    expect(getTierForCuts(500)).toBe('platinum')
  })
})

describe('getNextTier', () => {
  it('returns the next tier up, and null at the top', () => {
    expect(getNextTier('bronze')).toBe('silver')
    expect(getNextTier('silver')).toBe('gold')
    expect(getNextTier('gold')).toBe('platinum')
    expect(getNextTier('platinum')).toBeNull()
  })
})

describe('getCutsToNextTier', () => {
  it('returns the cuts remaining to reach the next tier', () => {
    expect(getCutsToNextTier(0)).toBe(5)
    expect(getCutsToNextTier(3)).toBe(2)
    expect(getCutsToNextTier(5)).toBe(10) // -> gold at 15
    expect(getCutsToNextTier(14)).toBe(1)
    expect(getCutsToNextTier(15)).toBe(15) // -> platinum at 30
    expect(getCutsToNextTier(29)).toBe(1)
    expect(getCutsToNextTier(30)).toBe(0) // already max
  })
})

describe('SPIN_PRIZES', () => {
  it('has weights summing to 100 (the spin math depends on this)', () => {
    const total = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0)
    expect(total).toBe(100)
  })
})

describe('GAME_LEVELS', () => {
  it('forms a contiguous ladder ending one below Hall of Fame', () => {
    expect(GAME_LEVELS[0].minCuts).toBe(0)
    for (let i = 1; i < GAME_LEVELS.length; i++) {
      // each level starts exactly where the previous one promotes
      expect(GAME_LEVELS[i].minCuts).toBe(GAME_LEVELS[i - 1].nextAt)
    }
    const last = GAME_LEVELS[GAME_LEVELS.length - 1]
    expect(last.nextAt).toBe(GAME_HOF_AT)
  })
})
