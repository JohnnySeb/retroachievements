import { Hono } from 'hono'

import type {
  PlayerAward,
  PlayerGameProgress,
  PlayerProgressPayload,
  RecentUnlock,
} from '../../src/lib/types'
import { TTL, cached, cachedWithMeta } from '../cache'
import { type RaUserProfile, normalizePlayerProfile } from '../normalize'
import { fetchRa, fetchRaOrNull } from '../ra-client'

// MaxMilyin a plus de 2000 awards : tout renvoyer produit 430 Ko de JSON.
const MAX_AWARDS = 60

interface RaAward {
  AwardedAt: string
  AwardType: string
  AwardData: number
  AwardDataExtra: number
  Title: string
  ConsoleName: string
  ImageIcon: string
}

interface RaRecentGame {
  GameID: number
  ConsoleID: number
  ConsoleName: string
  Title: string
  ImageIcon: string
  LastPlayed: string
  NumPossibleAchievements: number
  NumAchieved: number
  NumAchievedHardcore: number
}

interface RaCompletionEntry {
  GameID: number
  Title: string
  ImageIcon: string
  ConsoleID: number
  ConsoleName: string
  MaxPossible: number
  NumAwarded: number
  NumAwardedHardcore: number
  MostRecentAwardedDate: string | null
  HighestAwardKind: string | null
}

interface RaRecentUnlock {
  AchievementID: number
  GameID: number
  GameTitle: string
  Title: string
  Description: string
  Points: number
  TrueRatio: number
  BadgeName: string
  Type: string | null
  Date: string
  HardcoreMode: number
}

export const usersRoutes = new Hono()

usersRoutes.get('/users/:user', async (context) => {
  const user = context.req.param('user')

  const meta = await cachedWithMeta(`user:${user}`, TTL.user, async () => {
    const raw = await fetchRaOrNull<RaUserProfile>('GetUserProfile', { u: user })
    if (!raw?.User) return null

    const [awardsRaw, recentRaw] = await Promise.all([
      fetchRa<{ VisibleUserAwards?: RaAward[]; TotalAwardsCount?: number }>('GetUserAwards', {
        u: user,
      }),
      fetchRa<RaRecentGame[]>('GetUserRecentlyPlayedGames', { u: user, c: 12 }),
    ])

    const allAwards = awardsRaw?.VisibleUserAwards ?? []
    const awards: PlayerAward[] = allAwards
      .slice()
      .sort((a, b) => b.AwardedAt.localeCompare(a.AwardedAt))
      .slice(0, MAX_AWARDS)
      .map((entry) => ({
      awardedAt: entry.AwardedAt,
      awardType: entry.AwardType,
      title: entry.Title,
      systemName: entry.ConsoleName,
      iconPath: entry.ImageIcon,
      isHardcore: entry.AwardDataExtra === 1,
      gameId: entry.AwardData,
    }))

    const recentGames: PlayerGameProgress[] = (recentRaw ?? []).map((entry) => ({
      gameId: entry.GameID,
      title: entry.Title,
      systemId: entry.ConsoleID,
      systemName: entry.ConsoleName,
      iconPath: entry.ImageIcon,
      maxPossible: entry.NumPossibleAchievements,
      numAwarded: entry.NumAchieved,
      numAwardedHardcore: entry.NumAchievedHardcore,
      highestAwardKind: null,
      mostRecentAwardedDate: entry.LastPlayed,
    }))

    return {
      profile: normalizePlayerProfile(raw),
      awards,
      awardsTotal: awardsRaw?.TotalAwardsCount ?? allAwards.length,
      recentGames,
    }
  })

  if (!meta.value) return context.json({ error: 'Player not found' }, 404)
  if (meta.stale) context.header('X-Cache-Stale', meta.fetchedAt)
  return context.json(meta.value)
})

usersRoutes.get('/users/:user/progress', async (context) => {
  const user = context.req.param('user')

  const games = await cached(`user-progress:${user}`, TTL.user, async (): Promise<PlayerProgressPayload> => {
    const raw = await fetchRa<{ Results?: RaCompletionEntry[]; Total?: number }>(
      'GetUserCompletionProgress',
      { u: user, c: 500 },
    )
    // `Total` est le nombre reel de jeux joues ; `Results` est plafonne a 500 par l'API.
    const results = (raw?.Results ?? []).map(
      (entry): PlayerGameProgress => ({
        gameId: entry.GameID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        maxPossible: entry.MaxPossible,
        numAwarded: entry.NumAwarded,
        numAwardedHardcore: entry.NumAwardedHardcore,
        highestAwardKind: entry.HighestAwardKind,
        mostRecentAwardedDate: entry.MostRecentAwardedDate,
      }),
    )

    return { total: raw?.Total ?? results.length, results }
  })

  return context.json(games)
})

const KNOWN_TYPES: readonly string[] = ['progression', 'win_condition', 'missable']

usersRoutes.get('/users/:user/recent', async (context) => {
  const user = context.req.param('user')

  const unlocks = await cached(`user-recent:${user}`, TTL.user, async () => {
    // 10080 minutes = 7 jours : la fenetre la plus large qui reste lisible en une page.
    const raw = await fetchRa<RaRecentUnlock[]>('GetUserRecentAchievements', { u: user, m: 10080 })
    return (raw ?? []).map(
      (entry): RecentUnlock => ({
        id: entry.AchievementID,
        gameId: entry.GameID,
        gameTitle: entry.GameTitle,
        title: entry.Title,
        description: entry.Description,
        points: entry.Points,
        trueRatio: entry.TrueRatio,
        badgeName: entry.BadgeName,
        displayOrder: 0,
        type: entry.Type && KNOWN_TYPES.includes(entry.Type) ? (entry.Type as RecentUnlock['type']) : null,
        numAwarded: 0,
        numAwardedHardcore: 0,
        unlockRate: 0,
        unlockRateHardcore: 0,
        dateEarned: entry.Date,
        dateEarnedHardcore: entry.HardcoreMode === 1 ? entry.Date : null,
      }),
    )
  })

  return context.json(unlocks)
})
