import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UnpinButton from './UnpinButton.vue'

function mountButton() {
  return mount(UnpinButton, { props: { username: 'MaxMilyin' }, attachTo: document.body })
}

describe('UnpinButton', () => {
  it('does not unpin on the first click', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('asks for confirmation naming the player', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')

    expect(wrapper.get('[data-confirm-prompt]').text()).toContain('MaxMilyin')
  })

  it('emits confirm only on the second, explicit click', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')
    await wrapper.get('[data-unpin-confirm]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('can be cancelled', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')
    await wrapper.get('[data-unpin-cancel]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.find('[data-unpin]').exists()).toBe(true)
  })

  it('cancels on Escape', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')
    await wrapper.get('[data-confirm-prompt]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.find('[data-unpin]').exists()).toBe(true)
  })

  it('turns destructive on hover and while armed', () => {
    const wrapper = mountButton()

    expect(wrapper.get('[data-unpin]').classes().join(' ')).toContain('hover:border-magenta')
  })

  it('keeps every control at the minimum touch height', async () => {
    const wrapper = mountButton()
    await wrapper.get('[data-unpin]').trigger('click')

    for (const button of wrapper.findAll('button')) {
      expect(button.classes()).toContain('min-h-11')
    }
  })
})
