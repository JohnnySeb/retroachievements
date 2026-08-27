import { RouterLinkStub, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import PlayerGameRow from './PlayerGameRow.vue'
import type { PlayerGameProgress } from '@/lib/types'

const GAME: PlayerGameProgress = {
  gameId: 1,
  title: 'Sonic the Hedgehog',
  systemId: 1,
  systemName: 'Genesis/Mega Drive',
  iconPath: '/Images/085573.png',
  maxPossible: 35,
  numAwarded: 22,
  numAwardedHardcore: 16,
  highestAwardKind: null,
  mostRecentAwardedDate: null,
}

const PAYLOAD = {
  progress: {
    numAwarded: 22,
    numAwardedHardcore: 16,
    completionPct: 62.86,
    completionHardcorePct: 45.71,
    highestAwardKind: null,
  },
  achievements: [
    {
      id: 9, title: 'That Was Easy', description: 'Green Hill.', points: 3, trueRatio: 3,
      badgeName: '250336', displayOrder: 1, type: 'progression', numAwarded: 100,
      numAwardedHardcore: 50, unlockRate: 90, unlockRateHardcore: 45,
      dateEarned: '2026-01-01 00:00:00', dateEarnedHardcore: '2026-01-01 00:00:00',
    },
    {
      id: 10, title: 'Got Them All', description: 'Emeralds.', points: 25, trueRatio: 97,
      badgeName: '461376', displayOrder: 2, type: null, numAwarded: 10,
      numAwardedHardcore: 5, unlockRate: 10, unlockRateHardcore: 5,
      dateEarned: null, dateEarnedHardcore: null,
    },
  ],
}

function mountRow() {
  return mount(PlayerGameRow, {
    props: { game: GAME, username: 'MaxMilyin' },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('PlayerGameRow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('links the summary to the game page', () => {
    expect(mountRow().findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'game',
      params: { gameId: 1 },
    })
  })

  it('starts collapsed and makes no request', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mountRow()
    await settle()

    expect(wrapper.get('[data-toggle]').attributes('aria-expanded')).toBe('false')
    expect(spy).not.toHaveBeenCalled()
  })

  it('fetches the achievements only once expanded', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(PAYLOAD), { status: 200 }))

    const wrapper = mountRow()
    await wrapper.get('[data-toggle]').trigger('click')
    await settle()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0]![0])).toBe('/api/games/1/progress/MaxMilyin')
    expect(wrapper.get('[data-toggle]').attributes('aria-expanded')).toBe('true')
  })

  it('distinguishes unlocked from locked achievements in the panel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(PAYLOAD), { status: 200 }),
    )

    const wrapper = mountRow()
    await wrapper.get('[data-toggle]').trigger('click')
    await settle()

    const text = wrapper.text()
    expect(text).toContain('HARDCORE')
    expect(text).toContain('LOCKED')
  })

  it('wires the toggle to the panel for assistive tech', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(PAYLOAD), { status: 200 }),
    )

    const wrapper = mountRow()
    await wrapper.get('[data-toggle]').trigger('click')
    await settle()

    const controls = wrapper.get('[data-toggle]').attributes('aria-controls')
    expect(wrapper.find(`#${controls}`).exists()).toBe(true)
  })

  it('reports a failure inside the panel without breaking the row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Progress not found' }), { status: 404 }),
    )

    const wrapper = mountRow()
    await wrapper.get('[data-toggle]').trigger('click')
    await settle()

    expect(wrapper.text()).toContain('Progress not found')
    expect(wrapper.text()).toContain('Sonic the Hedgehog')
  })
})
