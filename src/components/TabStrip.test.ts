import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TabStrip from './TabStrip.vue'

const TABS = [
  { value: 'activity', label: 'Activite' },
  { value: 'games', label: 'Jeux' },
  { value: 'awards', label: 'Awards' },
]

function mountTabs(modelValue = 'activity') {
  return mount(TabStrip, { props: { tabs: TABS, modelValue } })
}

describe('TabStrip', () => {
  it('exposes a tablist role', () => {
    expect(mountTabs().find('[role="tablist"]').exists()).toBe(true)
  })

  it('marks the active tab with aria-selected', () => {
    const tabs = mountTabs('games').findAll('[role="tab"]')

    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    expect(tabs[0]!.attributes('aria-selected')).toBe('false')
  })

  it('emits the new value on click', async () => {
    const wrapper = mountTabs()
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['awards'])
  })

  it('scrolls horizontally instead of breaking the layout', () => {
    expect(mountTabs().get('[role="tablist"]').classes()).toContain('overflow-x-auto')
  })

  it('honours the minimum touch height', () => {
    expect(mountTabs().findAll('[role="tab"]')[0]!.classes()).toContain('min-h-11')
  })
})
