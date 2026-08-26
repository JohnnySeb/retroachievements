import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { unlockState, useAchievementFilters } from './useAchievementFilters'
import type { Achievement } from '@/lib/types'

function makeAchievement(overrides: Partial<Achievement>): Achievement {
  return {
    id: 1,
    title: 'A',
    description: '',
    points: 5,
    trueRatio: 5,
    badgeName: '1',
    displayOrder: 1,
    type: null,
    numAwarded: 10,
    numAwardedHardcore: 5,
    unlockRate: 50,
    unlockRateHardcore: 25,
    dateEarned: null,
    dateEarnedHardcore: null,
    ...overrides,
  }
}

const HARDCORE = makeAchievement({
  id: 1, displayOrder: 3, points: 5, unlockRate: 90,
  dateEarned: '2026-01-01 00:00:00', dateEarnedHardcore: '2026-01-01 00:00:00',
})
const SOFTCORE = makeAchievement({
  id: 2, displayOrder: 1, points: 25, unlockRate: 10,
  dateEarned: '2026-02-01 00:00:00', type: 'progression',
})
const LOCKED = makeAchievement({ id: 3, displayOrder: 2, points: 10, unlockRate: 3, type: 'missable' })

type Api = ReturnType<typeof useAchievementFilters>

async function withComposable(run: (api: Api) => void): Promise<void> {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: defineComponent({ render: () => h('div') }) }],
  })
  await router.push('/games/1')
  await router.isReady()

  let api: Api | null = null
  const Harness = defineComponent({
    setup() {
      api = useAchievementFilters(ref([HARDCORE, SOFTCORE, LOCKED]))
      return () => h('div')
    },
  })

  mount(Harness, { global: { plugins: [router] } })
  run(api as unknown as Api)
}

describe('unlockState', () => {
  it('distinguishes the three states', () => {
    expect(unlockState(HARDCORE)).toBe('hardcore')
    expect(unlockState(SOFTCORE)).toBe('softcore')
    expect(unlockState(LOCKED)).toBe('locked')
  })
})

describe('useAchievementFilters', () => {
  it('shows everything by default, sorted by displayOrder', async () => {
    await withComposable((api) => {
      expect(api.visible.value.map((entry) => entry.id)).toEqual([2, 3, 1])
    })
  })

  it('filters unlocked achievements', async () => {
    await withComposable((api) => {
      api.filter.value = 'unlocked'
      expect(api.visible.value.map((entry) => entry.id).sort()).toEqual([1, 2])
    })
  })

  it('filters locked achievements', async () => {
    await withComposable((api) => {
      api.filter.value = 'locked'
      expect(api.visible.value.map((entry) => entry.id)).toEqual([3])
    })
  })

  it('filters by type', async () => {
    await withComposable((api) => {
      api.filter.value = 'missable'
      expect(api.visible.value.map((entry) => entry.id)).toEqual([3])
    })
  })

  it('sorts by descending points', async () => {
    await withComposable((api) => {
      api.sort.value = 'points'
      expect(api.visible.value.map((entry) => entry.points)).toEqual([25, 10, 5])
    })
  })

  it('sorts by rarity, rarest first', async () => {
    await withComposable((api) => {
      api.sort.value = 'rarity'
      expect(api.visible.value.map((entry) => entry.unlockRate)).toEqual([3, 10, 90])
    })
  })

  it('sorts by earn date, most recent first and unearned last', async () => {
    await withComposable((api) => {
      api.sort.value = 'earned'
      expect(api.visible.value.map((entry) => entry.id)).toEqual([2, 1, 3])
    })
  })

  it('counts each category', async () => {
    await withComposable((api) => {
      expect(api.counts.value.all).toBe(3)
      expect(api.counts.value.unlocked).toBe(2)
      expect(api.counts.value.locked).toBe(1)
      expect(api.counts.value.missable).toBe(1)
      expect(api.counts.value.progression).toBe(1)
    })
  })
})
