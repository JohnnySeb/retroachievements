import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AwardWall from './AwardWall.vue'
import type { PlayerAward } from '@/lib/types'

function makeAward(overrides: Partial<PlayerAward> = {}): PlayerAward {
  return {
    awardedAt: '2024-12-22T21:43:11+00:00',
    awardType: 'Mastery/Completion',
    title: 'Kid Dracula',
    systemName: 'Game Boy',
    iconPath: '/Images/085573.png',
    isHardcore: true,
    gameId: 2231,
    ...overrides,
  }
}

function mountWall(awards: PlayerAward[]) {
  return mount(AwardWall, {
    props: { awards },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('AwardWall', () => {
  it('links a game award to its game page', () => {
    const wrapper = mountWall([makeAward()])

    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'game',
      params: { gameId: 2231 },
    })
  })

  it('does not link a site award that has no game', () => {
    // Certified Legend arrive avec AwardData=0, Title=null, ImageIcon=null.
    const wrapper = mountWall([
      makeAward({
        awardType: 'Certified Legend',
        title: 'Certified Legend',
        systemName: null,
        iconPath: null,
        gameId: null,
        isHardcore: false,
      }),
    ])

    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false)
    expect(wrapper.text()).toContain('Certified Legend')
  })

  it('renders no image when the award has no icon', () => {
    const wrapper = mountWall([makeAward({ iconPath: null, gameId: null })])

    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('colours by award type rather than claiming a hardcore state', () => {
    const mastery = mountWall([makeAward({ awardType: 'Mastery/Completion' })])
    const event = mountWall([makeAward({ awardType: 'Event', isHardcore: false })])
    const site = mountWall([makeAward({ awardType: 'Certified Legend', gameId: null })])

    expect(mastery.html()).toContain('border-l-magenta')
    expect(event.html()).toContain('border-l-cyan')
    expect(site.html()).toContain('border-l-edge')
  })

  it('distinguishes hardcore from softcore on a beaten game', () => {
    const hardcore = mountWall([makeAward({ awardType: 'Game Beaten', isHardcore: true })])
    const softcore = mountWall([makeAward({ awardType: 'Game Beaten', isHardcore: false })])

    expect(hardcore.html()).toContain('border-l-phosphor')
    expect(softcore.html()).toContain('border-l-amber')
  })

  it('groups awards by category, hardest first', () => {
    const wrapper = mountWall([
      makeAward({ awardType: 'Event', title: 'Four Job Fiesta', gameId: 124 }),
      makeAward({ awardType: 'Mastery/Completion', title: 'Kid Dracula' }),
      makeAward({ awardType: 'Game Beaten', title: 'Mega Man', gameId: 1448 }),
      makeAward({ awardType: 'Mastery/Completion', title: 'Sonic', gameId: 1 }),
    ])
    const groups = wrapper.findAll('[data-award-group]')

    expect(groups.map((g) => g.get('.tag').text())).toEqual([
      'Mastery/Completion',
      'Game Beaten',
      'Event',
    ])
    expect(groups[0]!.findAll('li')).toHaveLength(2)
  })

  it('places an unknown award type last rather than dropping it', () => {
    const wrapper = mountWall([
      makeAward({ awardType: 'Brand New Thing', gameId: null }),
      makeAward({ awardType: 'Game Beaten', gameId: 1448 }),
    ])
    const groups = wrapper.findAll('[data-award-group]')

    expect(groups.map((g) => g.get('.tag').text())).toEqual(['Game Beaten', 'Brand New Thing'])
  })

  it('keys rows without collapsing site awards that share a null game', () => {
    const wrapper = mountWall([
      makeAward({ gameId: null, awardedAt: '2024-01-01T00:00:00+00:00', title: 'A' }),
      makeAward({ gameId: null, awardedAt: '2024-02-01T00:00:00+00:00', title: 'B' }),
    ])

    expect(wrapper.findAll('li')).toHaveLength(2)
  })
})
