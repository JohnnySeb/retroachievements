import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRefreshState, startIndexRefresh, stopIndexRefresh } from './index-refresh'

describe('index refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stopIndexRefresh()
  })

  afterEach(() => {
    stopIndexRefresh()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not rebuild when a stored index was loaded', async () => {
    const load = vi.fn().mockResolvedValue(true)
    const build = vi.fn().mockResolvedValue([])

    await startIndexRefresh({ intervalMs: 1000, load, build })

    expect(build).not.toHaveBeenCalled()
  })

  it('rebuilds immediately when no stored index exists', async () => {
    const load = vi.fn().mockResolvedValue(false)
    const build = vi.fn().mockResolvedValue([])

    await startIndexRefresh({ intervalMs: 1000, load, build })

    expect(build).toHaveBeenCalledTimes(1)
  })

  it('rebuilds again once the interval elapses', async () => {
    const load = vi.fn().mockResolvedValue(true)
    const build = vi.fn().mockResolvedValue([])

    await startIndexRefresh({ intervalMs: 1000, load, build })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(build).toHaveBeenCalledTimes(2)
  })

  it('never runs two builds at once', async () => {
    const load = vi.fn().mockResolvedValue(false)
    let running = 0
    let peak = 0
    const build = vi.fn().mockImplementation(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 500))
      running -= 1
      return []
    })

    const started = startIndexRefresh({ intervalMs: 100, load, build })
    await vi.advanceTimersByTimeAsync(300)
    await vi.advanceTimersByTimeAsync(300)
    await started

    expect(peak).toBe(1)
  })

  it('exposes the build progress while indexing', async () => {
    const load = vi.fn().mockResolvedValue(false)
    const build = vi.fn().mockImplementation(async (onProgress: (d: number, t: number) => void) => {
      onProgress(12, 55)
      await new Promise((resolve) => setTimeout(resolve, 10))
      return []
    })

    const started = startIndexRefresh({ intervalMs: 1000, load, build })
    await vi.advanceTimersByTimeAsync(1)

    expect(getRefreshState().building).toBe(true)
    expect(getRefreshState().done).toBe(12)
    expect(getRefreshState().total).toBe(55)

    await vi.advanceTimersByTimeAsync(20)
    await started
    expect(getRefreshState().building).toBe(false)
  })

  it('survives a failing build without crashing', async () => {
    const load = vi.fn().mockResolvedValue(false)
    const build = vi.fn().mockRejectedValue(new Error('upstream down'))

    await expect(startIndexRefresh({ intervalMs: 1000, load, build })).resolves.toBeUndefined()
    expect(getRefreshState().building).toBe(false)
    expect(getRefreshState().lastError).toBe('upstream down')
  })
})
