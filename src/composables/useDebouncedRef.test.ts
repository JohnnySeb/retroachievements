import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useDebouncedRef } from './useDebouncedRef'

describe('useDebouncedRef', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the initial value immediately', () => {
    expect(useDebouncedRef(ref('sonic'), 200).value).toBe('sonic')
  })

  it('propagates the new value only after the delay', async () => {
    vi.useFakeTimers()
    const source = ref('so')
    const debounced = useDebouncedRef(source, 200)

    source.value = 'sonic'
    await nextTick()
    expect(debounced.value).toBe('so')

    vi.advanceTimersByTime(200)
    await nextTick()
    expect(debounced.value).toBe('sonic')
  })

  it('keeps only the last value of a burst', async () => {
    vi.useFakeTimers()
    const source = ref('s')
    const debounced = useDebouncedRef(source, 200)

    source.value = 'so'
    await nextTick()
    vi.advanceTimersByTime(100)
    source.value = 'son'
    await nextTick()
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(debounced.value).toBe('son')
  })
})
