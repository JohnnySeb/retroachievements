import { type Ref, onUnmounted, ref, watch } from 'vue'

export interface ApiError {
  status: number
  message: string
  indexing: boolean
}

type UrlSource = Ref<string | null> | (() => string | null)

export function useApi<T>(source: UrlSource) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<ApiError | null>(null)
  const pending = ref(false)
  const stale = ref<string | null>(null)

  let controller: AbortController | null = null

  async function load(): Promise<void> {
    const url = typeof source === 'function' ? source() : source.value
    controller?.abort()

    if (!url) {
      data.value = null
      error.value = null
      pending.value = false
      return
    }

    controller = new AbortController()
    pending.value = true
    error.value = null
    stale.value = null

    try {
      const response = await fetch(url, { signal: controller.signal })
      const body = (await response.json()) as Record<string, unknown>

      if (!response.ok) {
        data.value = null
        error.value = {
          status: response.status,
          message: typeof body.error === 'string' ? body.error : `Erreur ${response.status}`,
          indexing: body.status === 'indexing',
        }
        return
      }

      stale.value = response.headers.get('X-Cache-Stale')
      data.value = body as T
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return
      data.value = null
      error.value = { status: 0, message: 'Network unavailable', indexing: false }
    } finally {
      pending.value = false
    }
  }

  watch(typeof source === 'function' ? source : () => source.value, () => void load(), {
    immediate: true,
  })

  onUnmounted(() => controller?.abort())

  return { data, error, pending, stale, reload: () => void load() }
}
