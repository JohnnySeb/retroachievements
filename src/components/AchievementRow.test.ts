import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AchievementRow from './AchievementRow.vue'
import type { Achievement } from '@/lib/types'

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 9,
    title: 'That Was Easy',
    description: 'Complete the first act of Green Hill Zone.',
    points: 3,
    trueRatio: 3,
    badgeName: '250336',
    displayOrder: 1,
    type: 'progression',
    numAwarded: 54785,
    numAwardedHardcore: 25640,
    unlockRate: 90.22,
    unlockRateHardcore: 42.22,
    dateEarned: null,
    dateEarnedHardcore: null,
    ...overrides,
  }
}

describe('AchievementRow without a pinned player', () => {
  // Sans joueur epingle, l'etat de deblocage est inconnu : le rendu ne doit rien affirmer.
  it('claims no unlock state', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.text()).not.toContain('LOCKED')
    expect(wrapper.text()).not.toContain('HARDCORE')
    expect(wrapper.text()).not.toContain('SOFTCORE')
  })

  it('shows the coloured badge rather than the _lock variant', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.get('img').attributes('src')).not.toContain('_lock')
    expect(wrapper.get('img').attributes('alt')).toBe('Badge: That Was Easy')
  })

  it('still shows the rarity and the points', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.text()).toContain('90.2%')
    expect(wrapper.text()).toContain('TrueRatio 3')
  })
})

describe('AchievementRow with a pinned player', () => {
  it('uses the _lock badge when locked', () => {
    const wrapper = mount(AchievementRow, {
      props: { achievement: makeAchievement(), hasProgress: true },
    })

    expect(wrapper.get('img').attributes('src')).toContain('250336_lock.png')
  })

  it('uses the plain badge when unlocked', () => {
    const wrapper = mount(AchievementRow, {
      props: {
        achievement: makeAchievement({ dateEarnedHardcore: '2026-01-01 00:00:00' }),
        hasProgress: true,
      },
    })

    expect(wrapper.get('img').attributes('src')).toContain('250336.png')
    expect(wrapper.get('img').attributes('src')).not.toContain('_lock')
  })

  it('states the unlock state in text, not colour alone', () => {
    const locked = mount(AchievementRow, {
      props: { achievement: makeAchievement(), hasProgress: true },
    })
    const hardcore = mount(AchievementRow, {
      props: {
        achievement: makeAchievement({ dateEarnedHardcore: '2026-01-01 00:00:00' }),
        hasProgress: true,
      },
    })
    const softcore = mount(AchievementRow, {
      props: {
        achievement: makeAchievement({ dateEarned: '2026-01-01 00:00:00' }),
        hasProgress: true,
      },
    })

    expect(locked.text()).toContain('LOCKED')
    expect(hardcore.text()).toContain('HARDCORE')
    expect(softcore.text()).toContain('SOFTCORE')
  })

  it('gives the badge a descriptive alt', () => {
    const wrapper = mount(AchievementRow, {
      props: { achievement: makeAchievement(), hasProgress: true },
    })

    expect(wrapper.get('img').attributes('alt')).toBe('Locked badge: That Was Easy')
  })

  it('renders the badge as unsmoothed pixel art', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.get('img').classes()).toContain('is-pixel')
  })

  it('shows the unlock rate and the TrueRatio', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.text()).toContain('90.2%')
    expect(wrapper.text()).toContain('TrueRatio 3')
  })

  it('highlights a rare achievement', () => {
    const wrapper = mount(AchievementRow, {
      props: { achievement: makeAchievement({ unlockRate: 3.8 }) },
    })

    expect(wrapper.html()).toContain('text-magenta')
  })
})
