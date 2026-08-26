import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cached, cachedWithMeta, resetCache } from './cache'

describe('cached', () => {
  beforeEach(() => {
    resetCache()
    vi.useRealTimers()
  })

  it('calls the loader once within the lifetime', async () => {
    const loader = vi.fn().mockResolvedValue('valeur')

    await cached('k', 1000, loader)
    await cached('k', 1000, loader)

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('calls the loader again once the lifetime has elapsed', async () => {
    vi.useFakeTimers()
    const loader = vi.fn().mockResolvedValue('valeur')

    await cached('k', 1000, loader)
    vi.advanceTimersByTime(1500)
    await cached('k', 1000, loader)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('serves the stale value when the loader fails', async () => {
    vi.useFakeTimers()
    const loader = vi
      .fn()
      .mockResolvedValueOnce('fraiche')
      .mockRejectedValueOnce(new Error('amont indisponible'))

    await cached('k', 1000, loader)
    vi.advanceTimersByTime(1500)

    await expect(cached('k', 1000, loader)).resolves.toBe('fraiche')
  })

  it('propagates the error when no stale value exists', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('amont indisponible'))

    await expect(cached('vide', 1000, loader)).rejects.toThrow('amont indisponible')
  })

  it('runs a single loader for concurrent calls on the same key', async () => {
    let calls = 0
    const loader = async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return calls
    }

    await Promise.all([cached('k', 1000, loader), cached('k', 1000, loader)])

    expect(calls).toBe(1)
  })
})

describe('cachedWithMeta', () => {
  beforeEach(() => {
    resetCache()
    vi.useRealTimers()
  })

  it('reports a fresh value as not stale', async () => {
    const meta = await cachedWithMeta('k', 1000, async () => 'fraiche')

    expect(meta.value).toBe('fraiche')
    expect(meta.stale).toBe(false)
    expect(meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('reports a stale value with its original fetch time', async () => {
    vi.useFakeTimers()
    const loader = vi
      .fn()
      .mockResolvedValueOnce('fraiche')
      .mockRejectedValueOnce(new Error('amont indisponible'))

    await cached('k', 1000, loader)
    const fetchedAt = new Date().toISOString()
    vi.advanceTimersByTime(1500)

    const meta = await cachedWithMeta('k', 1000, loader)

    expect(meta.value).toBe('fraiche')
    expect(meta.stale).toBe(true)
    expect(meta.fetchedAt).toBe(fetchedAt)
  })
})
