import { Hono } from 'hono'

import type { GameSummary, SystemSummary } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'

interface RaConsole {
  ID: number
  Name: string
  IconURL: string
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

export async function loadSystems(): Promise<SystemSummary[]> {
  return cached('systems', TTL.systems, async () => {
    const raw = await fetchRa<RaConsole[]>('GetConsoleIDs', { a: 1, g: 1 })
    return raw.map((entry) => ({ id: entry.ID, name: entry.Name, iconUrl: entry.IconURL }))
  })
}

export const systemsRoutes = new Hono()

systemsRoutes.get('/systems', async (context) => {
  return context.json(await loadSystems())
})

systemsRoutes.get('/systems/:id/games', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'Invalid identifier' }, 400)

  const games = await cached(`system-games:${id}`, TTL.gameList, async () => {
    const raw = await fetchRa<RaGameListEntry[]>('GetGameList', { i: id, f: 1 })
    return raw.map(
      (entry): GameSummary => ({
        id: entry.ID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        numAchievements: entry.NumAchievements,
        points: entry.Points,
      }),
    )
  })

  return context.json(games)
})
