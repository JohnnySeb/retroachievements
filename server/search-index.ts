import type { GameSummary, SystemSummary } from '../src/lib/types'
import { readDisk, writeDisk } from './cache'
import { fetchRa } from './ra-client'

const INDEX_FILE = 'game-index.json'
const MIN_QUERY_LENGTH = 2
const SUBSET_PREFIX = /^~[^~]+~\s*/

interface IndexedGame extends GameSummary {
  normalized: string
  isPrimary: boolean
}

let index: IndexedGame[] = []

export function setIndex(games: GameSummary[]): void {
  index = games.map((game) => ({
    ...game,
    normalized: normalizeTitle(game.title),
    isPrimary: isPrimaryRelease(game.title),
  }))
}

// RA marque hacks, homebrews, prototypes par un prefixe ~...~ et les sous-ensembles
// par un suffixe [Subset - ...]. Une recherche doit remonter les sorties officielles
// avant les derives, sinon « zelda » noie les vrais jeux sous les ROM hacks.
export function isPrimaryRelease(title: string): boolean {
  return !SUBSET_PREFIX.test(title) && !title.includes('[Subset')
}

export function normalizeTitle(title: string): string {
  return title
    .replace(SUBSET_PREFIX, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function scoreMatch(normalizedTitle: string, normalizedQuery: string): number {
  const position = normalizedTitle.indexOf(normalizedQuery)
  if (position === -1) return -1
  if (position === 0) return 3
  return normalizedTitle[position - 1] === ' ' ? 2 : 1
}

export function searchGames(query: string, limit = 30): GameSummary[] {
  const normalizedQuery = normalizeTitle(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

  const scored: Array<{ game: IndexedGame; score: number }> = []
  for (const game of index) {
    const score = scoreMatch(game.normalized, normalizedQuery)
    if (score > -1) scored.push({ game, score })
  }

  scored.sort(
    (a, b) =>
      Number(b.game.isPrimary) - Number(a.game.isPrimary) ||
      b.score - a.score ||
      a.game.normalized.length - b.game.normalized.length ||
      b.game.numAchievements - a.game.numAchievements,
  )

  return scored.slice(0, limit).map(({ game }) => {
    const { normalized: _normalized, isPrimary: _isPrimary, ...summary } = game
    return summary
  })
}

export function searchSystems(query: string, systems: SystemSummary[]): SystemSummary[] {
  const normalizedQuery = normalizeTitle(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []
  return systems.filter(
    (system) => scoreMatch(normalizeTitle(system.name), normalizedQuery) > -1,
  )
}

export function getIndexStatus(): { ready: boolean; total: number } {
  return { ready: index.length > 0, total: index.length }
}

export async function loadIndex(): Promise<boolean> {
  const stored = await readDisk<GameSummary[]>(INDEX_FILE)
  if (!stored?.length) return false
  setIndex(stored)
  return true
}

interface RaGameListEntry {
  ID: number
  Title: string
  ConsoleID: number
  ConsoleName: string
  ImageIcon: string
  NumAchievements: number
  Points: number
}

export async function buildIndex(
  onProgress?: (done: number, total: number) => void,
): Promise<GameSummary[]> {
  const systems = await fetchRa<Array<{ ID: number; Name: string }>>('GetConsoleIDs', {
    a: 1,
    g: 1,
  })

  const games: GameSummary[] = []
  let done = 0
  for (const system of systems) {
    const entries = await fetchRa<RaGameListEntry[]>('GetGameList', { i: system.ID, f: 1 })
    for (const entry of entries) {
      games.push({
        id: entry.ID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        numAchievements: entry.NumAchievements,
        points: entry.Points,
      })
    }
    done += 1
    onProgress?.(done, systems.length)
  }

  await writeDisk(INDEX_FILE, games)
  setIndex(games)
  return games
}
