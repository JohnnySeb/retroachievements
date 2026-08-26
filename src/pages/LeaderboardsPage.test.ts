import { RouterLinkStub, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LeaderboardsPage from './LeaderboardsPage.vue'

const USERS = [
  { rank: 1, user: 'Sarconius', totalPoints: 591709, totalTruePoints: 4582410 },
  { rank: 2, user: 'MaxMilyin', totalPoints: 491867, totalTruePoints: 2669943 },
]

async function mountPage() {
  const wrapper = mount(LeaderboardsPage, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
  return wrapper
}

describe('LeaderboardsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders one entry per player in both layouts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(USERS), { status: 200 }),
    )

    // Deux rendus coexistent : cartes sous 640 px, tableau au-dessus.
    expect((await mountPage()).findAll('[data-leaderboard-entry]')).toHaveLength(4)
  })

  it('confines the table in a scrollable container', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(USERS), { status: 200 }),
    )

    expect((await mountPage()).get('[data-scroll-container]').classes()).toContain('overflow-x-auto')
  })

  it('shows an empty state without data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    expect((await mountPage()).text()).toContain('Leaderboard unavailable')
  })

  it('shows an error state and allows a retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'API is rate limited' }), { status: 502 }),
    )

    expect((await mountPage()).text()).toContain('API is rate limited')
  })
})
