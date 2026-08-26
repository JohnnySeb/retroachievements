import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePinnedPlayerStore } from './usePinnedPlayerStore'

describe('usePinnedPlayerStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with no pinned player', () => {
    expect(usePinnedPlayerStore().username).toBeNull()
  })

  it('pins a player and persists it', () => {
    const store = usePinnedPlayerStore()
    store.pin('MaxMilyin')

    expect(store.username).toBe('MaxMilyin')
    expect(localStorage.getItem('ra:pinned-player')).toBe('MaxMilyin')
  })

  it('trims the pseudo before storing it', () => {
    const store = usePinnedPlayerStore()
    store.pin('  MaxMilyin  ')

    expect(store.username).toBe('MaxMilyin')
  })

  it('ignores a blank pseudo', () => {
    const store = usePinnedPlayerStore()
    store.pin('   ')

    expect(store.username).toBeNull()
  })

  it('unpins and clears storage', () => {
    const store = usePinnedPlayerStore()
    store.pin('MaxMilyin')
    store.unpin()

    expect(store.username).toBeNull()
    expect(localStorage.getItem('ra:pinned-player')).toBeNull()
  })

  it('reads the persisted value on init', () => {
    localStorage.setItem('ra:pinned-player', 'Scott')
    setActivePinia(createPinia())

    expect(usePinnedPlayerStore().username).toBe('Scott')
  })
})
