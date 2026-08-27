import { Hono } from 'hono'

import type {
  Achievement,
  PlayerAward,
  PlayerGameProgress,
  PlayerProgressPayload,
  RecentUnlock,
  SuggestedUnlock,
} from '../../src/lib/types'
import { TTL, cached, cachedWithMeta } from '../cache'
import { type RaGameExtended, normalizeAchievement, type RaUserProfile, normalizePlayerProfile } from '../normalize'
import { fetchRa, fetchRaOrNull } from '../ra-client'

// MaxMilyin a plus de 2000 awards : tout renvoyer produit 430 Ko de JSON.
const MAX_AWARDS = 60

interface RaAward {
  AwardedAt: string
  AwardType: string
  AwardData: number
  AwardDataExtra: number
  Title: string | null
  ConsoleName: string | null
  ImageIcon: string | null
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

    const [awardsRaw, recentRaw, countRaw] = await Promise.all([
      fetchRa<{ VisibleUserAwards?: RaAward[]; TotalAwardsCount?: number }>('GetUserAwards', {
        u: user,
      }),
      fetchRa<RaRecentGame[]>('GetUserRecentlyPlayedGames', { u: user, c: 12 }),
      // c=1 : on ne veut que le Total, pas les 500 entrees de la liste.
      // Ce compteur est accessoire : son echec ne doit pas emporter tout le profil.
      fetchRa<{ Total?: number }>('GetUserCompletionProgress', { u: user, c: 1 }).catch(
        (): { Total?: number } => ({}),
      ),
    ])

    const allAwards = awardsRaw?.VisibleUserAwards ?? []
    const awards: PlayerAward[] = allAwards
      .slice()
      .sort((a, b) => b.AwardedAt.localeCompare(a.AwardedAt))
      .slice(0, MAX_AWARDS)
      .map((entry): PlayerAward => {
        const gameId = entry.AwardData > 0 ? entry.AwardData : null
        return {
          awardedAt: entry.AwardedAt,
          awardType: entry.AwardType,
          title: entry.Title ?? entry.AwardType,
          systemName: entry.ConsoleName ?? null,
          iconPath: entry.ImageIcon ?? null,
          // AwardDataExtra vaut aussi 2 sur les evenements : seul 1 signifie hardcore.
          isHardcore: gameId !== null && entry.AwardDataExtra === 1,
          gameId,
        }
      })

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
      gamesTotal: countRaw?.Total ?? 0,
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

// Nombre de jeux interroges pour batir des suggestions. Chaque jeu coute un appel
// amont : au-dela, on paierait cher une liste que personne ne fait defiler.
const SUGGESTION_GAMES = 8
const SUGGESTION_LIMIT = 30

interface RaGameProgressLite extends RaGameExtended {
  NumAwardedToUser: number
}

usersRoutes.get('/users/:user/suggestions', async (context) => {
  const user = context.req.param('user')

  const suggestions = await cached(
    `user-suggestions:${user}`,
    TTL.user,
    async (): Promise<SuggestedUnlock[]> => {
      const raw = await fetchRa<{ Results?: RaCompletionEntry[] }>('GetUserCompletionProgress', {
        u: user,
        c: 500,
      })

      // Un jeu deja fini n'offre rien ; un jeu jamais touche n'est pas une reprise.
      // Les jeux les plus avances viennent en premier : ce sont les gains les plus proches.
      const candidates = (raw?.Results ?? [])
        .filter((entry) => entry.NumAwarded > 0 && entry.NumAwarded < entry.MaxPossible)
        .sort((a, b) => b.NumAwarded / b.MaxPossible - a.NumAwarded / a.MaxPossible)
        .slice(0, SUGGESTION_GAMES)

      const perGame = await Promise.all(
        candidates.map(async (entry): Promise<SuggestedUnlock[]> => {
          try {
            const game = await fetchRa<RaGameProgressLite>('GetGameInfoAndUserProgress', {
              g: entry.GameID,
              u: user,
              a: 1,
            })

            return Object.values(game?.Achievements ?? {})
              .map((row) => normalizeAchievement(row, game.NumDistinctPlayers))
              .filter((achievement: Achievement) => !achievement.dateEarned)
              .map((achievement) => ({
                ...achievement,
                gameId: entry.GameID,
                gameTitle: entry.Title,
                gameIconPath: entry.ImageIcon,
                gameAwarded: entry.NumAwarded,
                gamePossible: entry.MaxPossible,
              }))
          } catch {
            // Un jeu injoignable ne doit pas vider toute la liste de suggestions.
            return []
          }
        }),
      )

      // Le taux de deblocage global est le meilleur indicateur de facilite dont
      // dispose l'API : plus de monde l'a obtenu, moins il est exigeant.
      return perGame
        .flat()
        .sort((a, b) => b.unlockRate - a.unlockRate || a.points - b.points)
        .slice(0, SUGGESTION_LIMIT)
    },
  )

  return context.json(suggestions)
})
