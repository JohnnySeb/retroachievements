import { getEnv } from './env'

const BASE_URL = 'https://retroachievements.org/API'
const MAX_CONCURRENCY = 2
const MAX_ATTEMPTS = 3

export class RaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RaApiError'
  }
}

let active = 0
const waiting: Array<() => void> = []

export function resetRaQueue(): void {
  active = 0
  waiting.length = 0
}

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active += 1
}

function release(): void {
  active -= 1
  waiting.shift()?.()
}

function backoffDelay(attempt: number): number {
  return 300 * 2 ** (attempt - 1)
}

/** Renvoie null quand la ressource amont n'existe pas, au lieu de propager une erreur. */
export async function fetchRaOrNull<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  try {
    return await fetchRa<T>(endpoint, params)
  } catch (error: unknown) {
    if (error instanceof RaApiError && error.status === 404) return null
    throw error
  }
}

export async function fetchRa<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<T> {
  const { raApiKey } = getEnv()
  const url = new URL(`${BASE_URL}/API_${endpoint}.php`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  url.searchParams.set('y', raApiKey)

  await acquire()
  try {
    let lastStatus = 0
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(url.toString())
      if (response.ok) {
        return (await response.json()) as T
      }
      lastStatus = response.status
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) break
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)))
      }
    }
    throw new RaApiError(`API_${endpoint} responded ${lastStatus}`, lastStatus)
  } finally {
    release()
  }
}
