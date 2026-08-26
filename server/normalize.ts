import type { Achievement, AchievementType, GameDetail, PlayerProfile } from '../src/lib/types'

export interface RaAchievement {
  ID: number
  NumAwarded: number
  NumAwardedHardcore: number
  Title: string
  Description: string
  Points: number
  TrueRatio: number
  BadgeName: string
  DisplayOrder: number
  // GetGameExtended renvoie `type`, GetGameInfoAndUserProgress renvoie `Type`.
  type?: string | null
  Type?: string | null
  DateEarned?: string
  DateEarnedHardcore?: string
}

export interface RaGameExtended {
  ID: number
  Title: string
  ConsoleID: number
  ConsoleName: string
  ImageIcon: string
  ImageTitle: string
  ImageIngame: string
  ImageBoxArt: string
  Publisher: string
  Developer: string
  Genre: string
  Released: string | null
  NumDistinctPlayers: number
  NumAchievements: number
  Achievements: Record<string, RaAchievement>
}

export interface RaUserProfile {
  User: string
  ULID: string
  UserPic: string
  MemberSince: string
  RichPresenceMsg: string
  LastGameID: number
  TotalPoints: number
  TotalSoftcorePoints: number
  TotalTruePoints: number
  Motto: string
  Rank?: number
}

const KNOWN_TYPES: readonly string[] = ['progression', 'win_condition', 'missable']

function toType(raw: string | null | undefined): AchievementType {
  if (!raw) return null
  return KNOWN_TYPES.includes(raw) ? (raw as AchievementType) : null
}

function rate(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

export function normalizeAchievement(raw: RaAchievement, distinctPlayers: number): Achievement {
  return {
    id: raw.ID,
    title: raw.Title,
    description: raw.Description,
    points: raw.Points,
    trueRatio: raw.TrueRatio,
    badgeName: raw.BadgeName,
    displayOrder: raw.DisplayOrder,
    type: toType(raw.type ?? raw.Type),
    numAwarded: raw.NumAwarded,
    numAwardedHardcore: raw.NumAwardedHardcore,
    unlockRate: rate(raw.NumAwarded, distinctPlayers),
    unlockRateHardcore: rate(raw.NumAwardedHardcore, distinctPlayers),
    dateEarned: raw.DateEarned ?? null,
    dateEarnedHardcore: raw.DateEarnedHardcore ?? null,
  }
}

export function normalizeGameDetail(raw: RaGameExtended): GameDetail {
  const achievements = Object.values(raw.Achievements ?? {})
    .map((entry) => normalizeAchievement(entry, raw.NumDistinctPlayers))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)

  return {
    id: raw.ID,
    title: raw.Title,
    systemId: raw.ConsoleID,
    systemName: raw.ConsoleName,
    developer: raw.Developer,
    publisher: raw.Publisher,
    genre: raw.Genre,
    released: raw.Released ?? null,
    iconPath: raw.ImageIcon,
    boxArtPath: raw.ImageBoxArt,
    titlePath: raw.ImageTitle,
    ingamePath: raw.ImageIngame,
    numDistinctPlayers: raw.NumDistinctPlayers,
    numAchievements: achievements.length,
    totalPoints: achievements.reduce((sum, entry) => sum + entry.points, 0),
    achievements,
  }
}

export function normalizePlayerProfile(raw: RaUserProfile): PlayerProfile {
  // L'API renvoie la chaine litterale "Unknown" quand aucune rich presence n'est active.
  const richPresence =
    raw.RichPresenceMsg && raw.RichPresenceMsg !== 'Unknown' ? raw.RichPresenceMsg : null

  return {
    user: raw.User,
    ulid: raw.ULID,
    avatarPath: raw.UserPic,
    motto: raw.Motto,
    memberSince: raw.MemberSince,
    rank: raw.Rank ?? null,
    totalPoints: raw.TotalPoints,
    totalSoftcorePoints: raw.TotalSoftcorePoints,
    totalTruePoints: raw.TotalTruePoints,
    richPresence,
    lastGameId: raw.LastGameID || null,
  }
}
