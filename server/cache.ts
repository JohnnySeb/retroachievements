import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const TTL = {
  home: 15 * MINUTE,
  systems: 24 * HOUR,
  gameList: 24 * HOUR,
  game: 1 * HOUR,
  user: 5 * MINUTE,
  leaderboard: 15 * MINUTE,
} as const

export interface CacheMeta<T> {
  value: T
  stale: boolean
  fetchedAt: string
}

interface Entry {
  value: unknown
  expiresAt: number
  fetchedAt: string
}

const entries = new Map<string, Entry>()
const inFlight = new Map<string, Promise<CacheMeta<unknown>>>()

export function resetCache(): void {
  entries.clear()
  inFlight.clear()
}

export async function cachedWithMeta<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CacheMeta<T>> {
  const existing = entries.get(key)
  if (existing && existing.expiresAt > Date.now()) {
    return { value: existing.value as T, stale: false, fetchedAt: existing.fetchedAt }
  }

  const running = inFlight.get(key)
  if (running) return running as Promise<CacheMeta<T>>

  const promise = loader()
    .then((value): CacheMeta<T> => {
      const fetchedAt = new Date().toISOString()
      entries.set(key, { value, expiresAt: Date.now() + ttlMs, fetchedAt })
      return { value, stale: false, fetchedAt }
    })
    .catch((error: unknown): CacheMeta<T> => {
      // Une donnee perimee vaut mieux qu'une page en erreur : l'interface l'etiquettera.
      if (existing) {
        return { value: existing.value as T, stale: true, fetchedAt: existing.fetchedAt }
      }
      throw error
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise as Promise<CacheMeta<unknown>>)
  return promise
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  return (await cachedWithMeta(key, ttlMs, loader)).value
}

function cacheDir(): string {
  try {
    return fileURLToPath(new URL('../.cache/', import.meta.url))
  } catch {
    // Sous Vitest, import.meta.url est une URL http : on retombe sur la racine du projet.
    return join(process.cwd(), '.cache/')
  }
}

export async function readDisk<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(cacheDir(), name), 'utf8')) as T
  } catch {
    return null
  }
}

export async function writeDisk<T>(name: string, value: T): Promise<void> {
  const target = join(cacheDir(), name)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(value), 'utf8')
}
