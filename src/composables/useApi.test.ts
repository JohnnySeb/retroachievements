import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useApi } from './useApi'

async function flush(): Promise<void> {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('useApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads data and clears pending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    )

    const { data, pending, error } = useApi<{ id: number }>(ref('/api/games/1'))
    await flush()

    expect(data.value).toEqual({ id: 1 })
    expect(pending.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('exposes an error with its status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'jeu introuvable' }), { status: 404 }),
    )

    const { error, data } = useApi(ref('/api/games/999'))
    await flush()

    expect(error.value?.status).toBe(404)
    expect(error.value?.message).toBe('jeu introuvable')
    expect(data.value).toBeNull()
  })

  it('flags indexing on a 503 indexing response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'indexing', total: 0 }), { status: 503 }),
    )

    const { error } = useApi(ref('/api/search?q=sonic'))
    await flush()

    expect(error.value?.indexing).toBe(true)
  })

  it('surfaces the stale header when the cache served old data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'X-Cache-Stale': '2026-08-01T00:00:00.000Z' },
      }),
    )

    const { stale } = useApi(ref('/api/games/1'))
    await flush()

    expect(stale.value).toBe('2026-08-01T00:00:00.000Z')
  })

  it('makes no call when the url is null', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')

    const { pending } = useApi(ref(null))
    await flush()

    expect(spy).not.toHaveBeenCalled()
    expect(pending.value).toBe(false)
  })

  it('reloads when the url changes', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    const url = ref<string | null>('/api/games/1')

    useApi(url)
    await flush()
    expect(spy).toHaveBeenCalledTimes(1)

    url.value = '/api/games/2'
    await flush()

    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[1]![0])).toBe('/api/games/2')
  })
})
