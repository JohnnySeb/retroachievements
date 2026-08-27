import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import TheBottomNav from './TheBottomNav.vue'

const blank = defineComponent({ render: () => h('div') })

async function mountNavAt(path = '/') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: blank },
      { path: '/systems', name: 'systems', component: blank },
      { path: '/leaderboards', name: 'leaderboards', component: blank },
      { path: '/games/:id', name: 'game', component: blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(TheBottomNav, {
    global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
  })
}

function mountNav() {
  return mount(TheBottomNav, {
    global: {
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $route: { name: 'home' } },
      provide: {},
    },
  })
}

describe('TheBottomNav', () => {
  it('exposes four destinations', async () => {
    expect((await mountNavAt()).findAll('[data-nav-item]')).toHaveLength(4)
  })

  it('carries a named navigation role', async () => {
    expect((await mountNavAt()).get('nav').attributes('aria-label')).toBe('Main navigation')
  })

  it('reserves the bottom safe area', async () => {
    const nav = (await mountNavAt()).get('nav')

    expect(nav.classes().join(' ')).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('emits a search request instead of navigating', async () => {
    const wrapper = await mountNavAt()
    await wrapper.get('[data-nav-search]').trigger('click')

    expect(wrapper.emitted('open-search')).toHaveLength(1)
  })

  it('is hidden above the md breakpoint', async () => {
    expect((await mountNavAt()).get('nav').classes()).toContain('md:hidden')
  })

  it('keeps every target at the minimum touch height', async () => {
    for (const item of (await mountNavAt()).findAll('[data-nav-item]')) {
      expect(item.classes()).toContain('min-h-11')
    }
  })

  it('marks the current page with aria-current', async () => {
    const wrapper = await mountNavAt('/leaderboards')
    const active = wrapper.findAll('[data-active]')

    expect(active).toHaveLength(1)
    expect(active[0]!.attributes('aria-current')).toBe('page')
    expect(active[0]!.text()).toContain('Ranks')
  })

  it('does not leave home highlighted on another page', async () => {
    const wrapper = await mountNavAt('/games/1')

    expect(wrapper.findAll('[data-active]')).toHaveLength(0)
  })
})
