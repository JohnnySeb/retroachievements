import { Hono } from 'hono'

import type { GameExtras, GameProgress } from '../../src/lib/types'
import { TTL, cached, cachedWithMeta } from '../cache'
import { type RaGameExtended, normalizeAchievement, normalizeGameDetail } from '../normalize'
import { fetchRa } from '../ra-client'

interface RaGameProgress extends RaGameExtended {
  NumAwardedToUser: number
  NumAwardedToUserHardcore: number
  UserCompletion: string
  UserCompletionHardcore: string
  HighestAwardKind: string | null
}

interface RaGameRankEntry {
  User: string
  NumAchievements: number
  TotalScore: number
}

interface RaLeaderboard {
  ID: number
  Title: string
  Description: string
  TopEntry: { User: string; FormattedScore: string } | null
}

function toPercent(raw: string): number {
  return Number.parseFloat(String(raw).replace('%', '')) || 0
}

export const gamesRoutes = new Hono()

gamesRoutes.get('/games/:id', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'Invalid identifier' }, 400)

  const meta = await cachedWithMeta(`game:${id}`, TTL.game, async () => {
    const raw = await fetchRa<RaGameExtended>('GetGameExtended', { i: id })
    if (!raw?.ID) return null
    return normalizeGameDetail(raw)
  })

  if (!meta.value) return context.json({ error: 'Game not found' }, 404)
  if (meta.stale) context.header('X-Cache-Stale', meta.fetchedAt)
  return context.json(meta.value)
})

gamesRoutes.get('/games/:id/extras', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'Invalid identifier' }, 400)

  const extras = await cached(`game-extras:${id}`, TTL.game, async (): Promise<GameExtras> => {
    const [distributionRaw, topRaw, leaderboardsRaw] = await Promise.all([
      fetchRa<Record<string, number>>('GetAchievementDistribution', { i: id, h: 1 }),
      fetchRa<RaGameRankEntry[]>('GetGameRankAndScore', { g: id, t: 0 }),
      fetchRa<{ Results?: RaLeaderboard[] }>('GetGameLeaderboards', { i: id, c: 10 }),
    ])

    return {
      distribution: Object.entries(distributionRaw ?? {})
        .map(([count, players]) => ({ count: Number(count), players }))
        .sort((a, b) => a.count - b.count),
      topPlayers: (topRaw ?? []).slice(0, 10).map((entry) => ({
        user: entry.User,
        numAchievements: entry.NumAchievements,
        totalScore: entry.TotalScore,
      })),
      leaderboards: (leaderboardsRaw?.Results ?? []).map((entry) => ({
        id: entry.ID,
        title: entry.Title,
        description: entry.Description,
        topEntry: entry.TopEntry
          ? { user: entry.TopEntry.User, formattedScore: entry.TopEntry.FormattedScore }
          : null,
      })),
    }
  })

  return context.json(extras)
})

gamesRoutes.get('/games/:id/progress/:user', async (context) => {
  const id = Number(context.req.param('id'))
  const user = context.req.param('user')
  if (!Number.isInteger(id)) return context.json({ error: 'Invalid identifier' }, 400)

  const result = await cached(`game-progress:${id}:${user}`, TTL.user, async () => {
    const raw = await fetchRa<RaGameProgress>('GetGameInfoAndUserProgress', {
      g: id,
      u: user,
      a: 1,
    })
    if (!raw?.ID) return null

    const progress: GameProgress = {
      numAwarded: raw.NumAwardedToUser ?? 0,
      numAwardedHardcore: raw.NumAwardedToUserHardcore ?? 0,
      completionPct: toPercent(raw.UserCompletion ?? '0%'),
      completionHardcorePct: toPercent(raw.UserCompletionHardcore ?? '0%'),
      highestAwardKind: raw.HighestAwardKind ?? null,
    }

    const achievements = Object.values(raw.Achievements ?? {})
      .map((entry) => normalizeAchievement(entry, raw.NumDistinctPlayers))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)

    return { progress, achievements }
  })

  if (!result) return context.json({ error: 'Progress not found' }, 404)
  return context.json(result)
})
