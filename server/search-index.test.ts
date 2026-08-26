import { beforeEach, describe, expect, it } from 'vitest'

import {
  isPrimaryRelease,
  normalizeTitle,
  scoreMatch,
  searchGames,
  searchSystems,
  setIndex,
} from './search-index'

describe('normalizeTitle', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeTitle('Pokémon Rouge')).toBe('pokemon rouge')
  })

  it('strips the subset prefixes RA uses', () => {
    expect(normalizeTitle('~Hack~ Earthbound Beginnings Remake')).toBe(
      'earthbound beginnings remake',
    )
    expect(normalizeTitle('~Homebrew~ Micro Mages')).toBe('micro mages')
  })

  it('collapses punctuation into single spaces', () => {
    expect(normalizeTitle('Sonic  the   Hedgehog 2')).toBe('sonic the hedgehog 2')
    expect(normalizeTitle('Sonic the Hedgehog [Subset - Perfect Bonus]')).toBe(
      'sonic the hedgehog subset perfect bonus',
    )
  })
})

describe('scoreMatch', () => {
  it('ranks prefix above word start above substring', () => {
    const prefix = scoreMatch('sonic the hedgehog', 'sonic')
    const wordStart = scoreMatch('super sonic racing', 'sonic')
    const substring = scoreMatch('supersonic', 'sonic')

    expect(prefix).toBeGreaterThan(wordStart)
    expect(wordStart).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(-1)
  })

  it('returns -1 without a match', () => {
    expect(scoreMatch('sonic the hedgehog', 'mario')).toBe(-1)
  })
})

describe('isPrimaryRelease', () => {
  it('treats an untagged title as a primary release', () => {
    expect(isPrimaryRelease('The Legend of Zelda')).toBe(true)
  })

  it('treats hacks, homebrews and subsets as derivatives', () => {
    expect(isPrimaryRelease('~Hack~ Zelda 64: Dawn & Dusk')).toBe(false)
    expect(isPrimaryRelease('~Homebrew~ Micro Mages')).toBe(false)
    expect(isPrimaryRelease('Sonic the Hedgehog [Subset - Perfect Bonus]')).toBe(false)
  })
})

const INDEX = [
  { id: 1, title: 'Sonic the Hedgehog', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/085573.png', numAchievements: 35, points: 300 },
  { id: 10, title: 'Sonic the Hedgehog 2', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/121647.png', numAchievements: 32, points: 420 },
  { id: 29895, title: 'Sonic the Hedgehog [Subset - Perfect Bonus]', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/121648.png', numAchievements: 24, points: 425 },
  { id: 3, title: 'Streets of Rage 2', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/120551.png', numAchievements: 40, points: 626 },
]

describe('searchGames', () => {
  beforeEach(() => {
    setIndex(INDEX)
  })

  it('finds games by substring', () => {
    expect(searchGames('sonic').map((game) => game.id)).toContain(1)
  })

  it('ranks primary releases above hacks and subsets', () => {
    setIndex([
      { id: 100, title: '~Hack~ Zelda 64: Dawn & Dusk', systemId: 2, systemName: 'Nintendo 64', iconPath: '/x.png', numAchievements: 15, points: 100 },
      { id: 101, title: '~Hack~ Zelda II: Amida\'s Curse', systemId: 7, systemName: 'NES/Famicom', iconPath: '/x.png', numAchievements: 32, points: 200 },
      { id: 102, title: 'The Legend of Zelda', systemId: 7, systemName: 'NES/Famicom', iconPath: '/x.png', numAchievements: 40, points: 400 },
      { id: 103, title: 'Zelda II: The Adventure of Link', systemId: 7, systemName: 'NES/Famicom', iconPath: '/x.png', numAchievements: 44, points: 450 },
    ])

    const ids = searchGames('zelda').map((game) => game.id)

    expect(ids.slice(0, 2).sort()).toEqual([102, 103])
    expect(ids.slice(2).sort()).toEqual([100, 101])
  })

  it('ranks the shortest title first at equal score', () => {
    expect(searchGames('sonic the hedgehog')[0]!.id).toBe(1)
  })

  it('excludes games with no match', () => {
    expect(searchGames('rage').map((game) => game.id)).toEqual([3])
  })

  it('honours the requested limit', () => {
    expect(searchGames('sonic', 2)).toHaveLength(2)
  })

  it('returns an empty array for a query that is too short', () => {
    expect(searchGames('s')).toEqual([])
  })

  it('does not leak the internal ranking fields', () => {
    const keys = Object.keys(searchGames('sonic')[0]!)

    expect(keys).not.toContain('normalized')
    expect(keys).not.toContain('isPrimary')
  })
})

describe('searchSystems', () => {
  it('matches systems by name', () => {
    const systems = [
      { id: 1, name: 'Genesis/Mega Drive', iconUrl: 'x' },
      { id: 7, name: 'NES/Famicom', iconUrl: 'y' },
    ]

    expect(searchSystems('famicom', systems).map((system) => system.id)).toEqual([7])
  })
})
