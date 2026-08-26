import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TheBottomNav from './TheBottomNav.vue'

function mountNav() {
  return mount(TheBottomNav, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('TheBottomNav', () => {
  it('exposes four destinations', () => {
    expect(mountNav().findAll('[data-nav-item]')).toHaveLength(4)
  })

  it('carries a named navigation role', () => {
    expect(mountNav().get('nav').attributes('aria-label')).toBe('Main navigation')
  })

  it('reserves the bottom safe area', () => {
    expect(mountNav().get('nav').classes().join(' ')).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('emits a search request instead of navigating', async () => {
    const wrapper = mountNav()
    await wrapper.get('[data-nav-search]').trigger('click')

    expect(wrapper.emitted('open-search')).toHaveLength(1)
  })

  it('is hidden above the md breakpoint', () => {
    expect(mountNav().get('nav').classes()).toContain('md:hidden')
  })

  it('keeps every target at the minimum touch height', () => {
    for (const item of mountNav().findAll('[data-nav-item]')) {
      expect(item.classes()).toContain('min-h-11')
    }
  })
})
