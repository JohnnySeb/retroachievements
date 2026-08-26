import { Hono } from 'hono'

import type { LeaderboardUser } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'

export async function loadTopUsers(): Promise<LeaderboardUser[]> {
  return cached('top-users', TTL.leaderboard, async () => {
    const raw = await fetchRa<unknown[]>('GetTopTenUsers', {})
    return (raw ?? []).map((entry, position) => normalizeTopUser(entry, position))
  })
}

// GetTopTenUsers a change de forme au fil des versions de RAWeb : on accepte
// les deux, cles numeriques historiques et champs nommes actuels.
function normalizeTopUser(entry: unknown, position: number): LeaderboardUser {
  const record = entry as Record<string, unknown>
  return {
    rank: position + 1,
    user: String(record.User ?? record['1'] ?? ''),
    totalPoints: Number(record.Score ?? record.TotalPoints ?? record['2'] ?? 0),
    totalTruePoints: Number(record.RetroPoints ?? record.TotalTruePoints ?? record['3'] ?? 0),
  }
}

export const leaderboardsRoutes = new Hono()

leaderboardsRoutes.get('/leaderboards', async (context) => {
  return context.json(await loadTopUsers())
})
