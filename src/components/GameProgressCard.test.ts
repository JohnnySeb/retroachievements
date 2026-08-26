import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GameProgressCard from './GameProgressCard.vue'
import type { PlayerGameProgress } from '@/lib/types'

function makeGame(overrides: Partial<PlayerGameProgress> = {}): PlayerGameProgress {
  return {
    gameId: 1,
    title: 'Sonic the Hedgehog',
    systemId: 1,
    systemName: 'Genesis/Mega Drive',
    iconPath: '/Images/085573.png',
    maxPossible: 35,
    numAwarded: 22,
    numAwardedHardcore: 16,
    highestAwardKind: null,
    mostRecentAwardedDate: '2026-08-01 12:00:00',
    ...overrides,
  }
}

function mountCard(game: PlayerGameProgress) {
  return mount(GameProgressCard, {
    props: { game },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('GameProgressCard', () => {
  it('shows progress as a fraction', () => {
    expect(mountCard(makeGame()).text()).toContain('22/35')
  })

  it('exposes progress to screen readers', () => {
    expect(mountCard(makeGame()).get('[role="progressbar"]').attributes('aria-valuenow')).toBe('63')
  })

  it('shows the mastery badge when the game is mastered', () => {
    expect(mountCard(makeGame({ highestAwardKind: 'mastered' })).text()).toContain('MASTERED')
  })

  it('shows no badge without an award', () => {
    expect(mountCard(makeGame()).text()).not.toContain('MASTERED')
  })

  it('tolerates a game with no possible achievement', () => {
    const wrapper = mountCard(makeGame({ maxPossible: 0, numAwarded: 0, numAwardedHardcore: 0 }))

    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('ignores an unknown award kind rather than rendering it raw', () => {
    expect(mountCard(makeGame({ highestAwardKind: 'something-new' })).text()).not.toContain(
      'something-new',
    )
  })
})
