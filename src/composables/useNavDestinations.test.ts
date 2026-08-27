import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useNavDestinations } from './useNavDestinations'

async function activeAt(path: string): Promise<string[]> {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: defineComponent({ render: () => h('div') }) },
      { path: '/systems', name: 'systems', component: defineComponent({ render: () => h('div') }) },
      { path: '/systems/:id', name: 'system-games', component: defineComponent({ render: () => h('div') }) },
      { path: '/games/:id', name: 'game', component: defineComponent({ render: () => h('div') }) },
      { path: '/users/:u', name: 'player', component: defineComponent({ render: () => h('div') }) },
      { path: '/leaderboards', name: 'leaderboards', component: defineComponent({ render: () => h('div') }) },
    ],
  })
  await router.push(path)
  await router.isReady()

  let names: string[] = []
  const Harness = defineComponent({
    setup() {
      const destinations = useNavDestinations()
      names = destinations.value.filter((d) => d.isActive).map((d) => d.name)
      return () => h('div')
    },
  })
  mount(Harness, { global: { plugins: [router] } })
  return names
}

describe('useNavDestinations', () => {
  it('marks home active only on the home route', async () => {
    await expect(activeAt('/')).resolves.toEqual(['home'])
  })

  it('does not keep home active on other routes', async () => {
    // Le chemin `/` est un prefixe de toutes les routes : la correspondance
    // inclusive de router-link garderait Home allume partout.
    await expect(activeAt('/leaderboards')).resolves.not.toContain('home')
    await expect(activeAt('/games/1')).resolves.not.toContain('home')
  })

  it('marks systems active on a system game list', async () => {
    await expect(activeAt('/systems/12')).resolves.toEqual(['systems'])
  })

  it('marks leaderboards active on its own route', async () => {
    await expect(activeAt('/leaderboards')).resolves.toEqual(['leaderboards'])
  })

  it('marks nothing active on routes with no nav entry', async () => {
    await expect(activeAt('/games/1')).resolves.toEqual([])
    await expect(activeAt('/users/MaxMilyin')).resolves.toEqual([])
  })
})
