import { RouterLinkStub, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import PinnedPlayerCard from './PinnedPlayerCard.vue'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'

const PROFILE = {
  profile: {
    user: 'MaxMilyin',
    ulid: 'X',
    avatarPath: '/UserPic/MaxMilyin.png',
    motto: 'LIVE RA',
    memberSince: '2016-01-02 00:43:04',
    rank: null,
    totalPoints: 491867,
    totalSoftcorePoints: 0,
    totalTruePoints: 2669943,
    richPresence: 'PUP38 on HorizonXI',
    lastGameId: 28275,
  },
  awards: [],
  awardsTotal: 0,
  gamesTotal: 1629,
  recentGames: [],
}

function mountCard() {
  return mount(PinnedPlayerCard, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('PinnedPlayerCard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when no player is pinned', () => {
    expect(mountCard().find('[data-pinned-card]').exists()).toBe(false)
  })

  it('makes no request when no player is pinned', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    mountCard()
    await settle()

    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the pinned player and a link to the profile', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(PROFILE), { status: 200 }),
    )
    usePinnedPlayerStore().pin('MaxMilyin')

    const wrapper = mountCard()
    await settle()

    expect(wrapper.get('[data-pinned-card]').text()).toContain('MaxMilyin')
    expect(wrapper.text()).toContain('Go to this profile')
  })

  it('shows softcore before points, then true points and games played', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(PROFILE), { status: 200 }),
    )
    usePinnedPlayerStore().pin('MaxMilyin')

    const wrapper = mountCard()
    await settle()
    const text = wrapper.get('[data-pinned-card]').text().replace(/\s+/g, ' ')

    expect(text).toContain('0 softcore')
    expect(text).toContain('491,867 points')
    expect(text).toContain('1,629 games played')
    expect(text.indexOf('softcore')).toBeLessThan(text.indexOf('points'))
  })

  it('still offers the profile link when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Player not found' }), { status: 404 }),
    )
    usePinnedPlayerStore().pin('ghost')

    const wrapper = mountCard()
    await settle()

    expect(wrapper.get('[data-pinned-card]').text()).toContain('ghost')
    expect(wrapper.text()).toContain('Go to this profile')
  })

  it('requires a confirmation before unpinning', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(PROFILE), { status: 200 }),
    )
    const store = usePinnedPlayerStore()
    store.pin('MaxMilyin')

    const wrapper = mountCard()
    await settle()

    await wrapper.get('[data-unpin]').trigger('click')
    expect(store.username).toBe('MaxMilyin')

    await wrapper.get('[data-unpin-confirm]').trigger('click')
    expect(store.username).toBeNull()
    expect(localStorage.getItem('ra:pinned-player')).toBeNull()
  })
})
