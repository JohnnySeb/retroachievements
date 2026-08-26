import { Hono } from 'hono'

import type {
  AchievementOfTheWeek,
  AchievementType,
  HomePayload,
  RecentAward,
} from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'
import { loadTopUsers } from './leaderboards'

interface RaAotw {
  Achievement?: {
    ID: number
    Title: string
    Description: string
    Points: number
    TrueRatio: number
    Type: string | null
    BadgeName: string
  }
  Console?: { Title: string }
  Game?: { ID: number; Title: string }
  StartAt?: string
  TotalPlayers?: number
  UnlocksHardcoreCount?: number
}

interface RaRecentAward {
  User: string
  AwardKind: string
  AwardDate: string
  GameID: number
  GameTitle: string
  ConsoleName: string
}

const KNOWN_TYPES: readonly string[] = ['progression', 'win_condition', 'missable']

function toAchievementOfTheWeek(raw: RaAotw): AchievementOfTheWeek | null {
  const achievement = raw?.Achievement
  if (!achievement?.ID) return null

  return {
    id: achievement.ID,
    title: achievement.Title,
    description: achievement.Description,
    points: achievement.Points,
    trueRatio: achievement.TrueRatio,
    type:
      achievement.Type && KNOWN_TYPES.includes(achievement.Type)
        ? (achievement.Type as AchievementType)
        : null,
    badgeName: achievement.BadgeName,
    gameId: raw.Game?.ID ?? 0,
    gameTitle: raw.Game?.Title ?? '',
    systemName: raw.Console?.Title ?? '',
    startAt: raw.StartAt ?? '',
    totalPlayers: raw.TotalPlayers ?? 0,
    unlocksHardcoreCount: raw.UnlocksHardcoreCount ?? 0,
  }
}

export const homeRoutes = new Hono()

homeRoutes.get('/home', async (context) => {
  const payload = await cached('home', TTL.home, async (): Promise<HomePayload> => {
    const [topUsers, aotwRaw, awardsRaw] = await Promise.all([
      loadTopUsers(),
      // Ces deux appels ne doivent pas faire echouer l'accueil : chacun degrade en valeur vide.
      fetchRa<RaAotw>('GetAchievementOfTheWeek', {}).catch(() => ({}) as RaAotw),
      fetchRa<{ Results?: RaRecentAward[] }>('GetRecentGameAwards', { c: 12 }).catch(
        (): { Results?: RaRecentAward[] } => ({}),
      ),
    ])

    const recentAwards: RecentAward[] = (awardsRaw?.Results ?? []).map(
      (entry): RecentAward => ({
        user: entry.User,
        awardKind: entry.AwardKind,
        awardDate: entry.AwardDate,
        gameId: entry.GameID,
        gameTitle: entry.GameTitle,
        systemName: entry.ConsoleName,
      }),
    )

    return { topUsers, achievementOfTheWeek: toAchievementOfTheWeek(aotwRaw), recentAwards }
  })

  return context.json(payload)
})
