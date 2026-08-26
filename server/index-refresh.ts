import type { GameSummary } from '../src/lib/types'
import { buildIndex, loadIndex } from './search-index'

const DAY = 24 * 60 * 60_000

export interface RefreshState {
  building: boolean
  done: number
  total: number
  lastBuiltAt: string | null
  lastError: string | null
}

interface RefreshOptions {
  intervalMs?: number
  load?: () => Promise<boolean>
  build?: (onProgress: (done: number, total: number) => void) => Promise<GameSummary[]>
}

const state: RefreshState = {
  building: false,
  done: 0,
  total: 0,
  lastBuiltAt: null,
  lastError: null,
}

let timer: ReturnType<typeof setInterval> | null = null

export function getRefreshState(): RefreshState {
  return { ...state }
}

export function stopIndexRefresh(): void {
  if (timer) clearInterval(timer)
  timer = null
  Object.assign(state, { building: false, done: 0, total: 0, lastBuiltAt: null, lastError: null })
}

async function runBuild(
  build: NonNullable<RefreshOptions['build']>,
): Promise<void> {
  // Un second passage pendant qu'un premier tourne doublerait les appels sortants.
  if (state.building) return

  state.building = true
  state.done = 0
  state.total = 0
  state.lastError = null

  try {
    await build((done, total) => {
      state.done = done
      state.total = total
    })
    state.lastBuiltAt = new Date().toISOString()
  } catch (error: unknown) {
    // Un echec d'indexation ne doit jamais abattre le serveur : le reste du site fonctionne.
    state.lastError = error instanceof Error ? error.message : String(error)
  } finally {
    state.building = false
  }
}

export async function startIndexRefresh(options: RefreshOptions = {}): Promise<void> {
  const intervalMs = options.intervalMs ?? DAY
  const load = options.load ?? loadIndex
  const build = options.build ?? buildIndex

  stopIndexRefresh()

  timer = setInterval(() => void runBuild(build), intervalMs)
  // unref évite que l'intervalle maintienne le process en vie à lui seul.
  timer.unref?.()

  const hasStoredIndex = await load()
  if (!hasStoredIndex) {
    await runBuild(build)
  }
}
