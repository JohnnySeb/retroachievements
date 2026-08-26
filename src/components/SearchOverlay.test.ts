import { RouterLinkStub, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import SearchOverlay from './SearchOverlay.vue'

function mountOverlay(open = true) {
  // attachTo est requis : sans montage dans le document, .focus() est sans effet
  // et document.activeElement reste <body>.
  return mount(SearchOverlay, {
    props: { open },
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 260))
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ games: [], player: null, systems: [] }), { status: 200 }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    expect(mountOverlay(false).find('[data-search-dialog]').exists()).toBe(false)
  })

  it('exposes a modal dialog role', () => {
    const dialog = mountOverlay().get('[data-search-dialog]')

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('wires the field as a combobox', () => {
    const input = mountOverlay().get('input')

    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('true')
  })

  it('emits close on Escape', async () => {
    const wrapper = mountOverlay()
    await wrapper.get('[data-search-dialog]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('keeps focus inside the dialog when tabbing past the last target', async () => {
    const wrapper = mountOverlay()
    const dialog = wrapper.get('[data-search-dialog]')
    const targets = dialog.element.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')
    const last = targets[targets.length - 1] as HTMLElement
    last.focus()

    await dialog.trigger('keydown', { key: 'Tab' })

    expect(document.activeElement).toBe(targets[0])
  })

  it('makes no request below two characters', async () => {
    const wrapper = mountOverlay()
    await wrapper.get('input').setValue('s')
    await settle()

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('shows the indexing state on a 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'indexing', total: 0 }), { status: 503 }),
    )
    const wrapper = mountOverlay()
    await wrapper.get('input').setValue('sonic')
    await settle()

    expect(wrapper.text()).toContain('Search index not built')
  })

  it('lists the games returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          games: [
            {
              id: 1,
              title: 'Sonic the Hedgehog',
              systemId: 1,
              systemName: 'Genesis/Mega Drive',
              iconPath: '/Images/085573.png',
              numAchievements: 35,
              points: 300,
            },
          ],
          player: null,
          systems: [],
        }),
        { status: 200 },
      ),
    )
    const wrapper = mountOverlay()
    await wrapper.get('input').setValue('sonic')
    await settle()

    expect(wrapper.text()).toContain('Sonic the Hedgehog')
  })
})
