import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RaApiError, fetchRa, resetRaQueue } from './ra-client'

describe('fetchRa', () => {
  beforeEach(() => {
    process.env.RA_API_KEY = 'test-key'
    resetRaQueue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the URL with the key in the y param', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ID: 1 }), { status: 200 }))

    await fetchRa('GetGameExtended', { i: 1 })

    const url = new URL(spy.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/API/API_GetGameExtended.php')
    expect(url.searchParams.get('i')).toBe('1')
    expect(url.searchParams.get('y')).toBe('test-key')
  })

  it('retries on 429 then succeeds', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const result = await fetchRa<{ ok: boolean }>('GetConsoleIDs', {})

    expect(result.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('throws RaApiError once attempts are exhausted', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))

    await expect(fetchRa('GetConsoleIDs', {})).rejects.toBeInstanceOf(RaApiError)
  })

  it('does not retry a non-retryable status', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))

    await expect(fetchRa('GetConsoleIDs', {})).rejects.toBeInstanceOf(RaApiError)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('never exceeds two concurrent outbound calls', async () => {
    let inFlight = 0
    let peak = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return new Response(JSON.stringify({}), { status: 200 })
    })

    await Promise.all(Array.from({ length: 8 }, () => fetchRa('GetConsoleIDs', {})))

    expect(peak).toBeLessThanOrEqual(2)
  })

  it('releases the queue slot when a call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))

    await Promise.allSettled(Array.from({ length: 5 }, () => fetchRa('GetConsoleIDs', {})))

    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await expect(fetchRa<{ ok: boolean }>('GetConsoleIDs', {})).resolves.toEqual({ ok: true })
    expect(spy).toHaveBeenCalled()
  })
})
