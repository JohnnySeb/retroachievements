export interface SystemSummary {
  id: number
  name: string
  iconUrl: string
}

export interface GameSummary {
  id: number
  title: string
  systemId: number
  systemName: string
  iconPath: string
  numAchievements: number
  points: number
}

export type AchievementType = 'progression' | 'win_condition' | 'missable' | null

export interface Achievement {
  id: number
  title: string
  description: string
  points: number
  trueRatio: number
  badgeName: string
  displayOrder: number
  type: AchievementType
  numAwarded: number
  numAwardedHardcore: number
  unlockRate: number
  unlockRateHardcore: number
  dateEarned: string | null
  dateEarnedHardcore: string | null
}

export interface RecentUnlock extends Achievement {
  gameId: number
  gameTitle: string
}

export interface SuggestedUnlock extends Achievement {
  gameId: number
  gameTitle: string
  gameIconPath: string
  /** Achievements deja obtenus par le joueur sur ce jeu, sur le total du set. */
  gameAwarded: number
  gamePossible: number
}

export interface GameDetail {
  id: number
  title: string
  systemId: number
  systemName: string
  developer: string
  publisher: string
  genre: string
  released: string | null
  iconPath: string
  boxArtPath: string
  titlePath: string
  ingamePath: string
  numDistinctPlayers: number
  numAchievements: number
  totalPoints: number
  achievements: Achievement[]
}

export interface GameProgress {
  numAwarded: number
  numAwardedHardcore: number
  completionPct: number
  completionHardcorePct: number
  highestAwardKind: string | null
}

export interface PlayerProfile {
  user: string
  ulid: string
  avatarPath: string
  motto: string
  memberSince: string
  // GetUserProfile n'expose aucun rang global : null tant qu'aucune source ne le fournit.
  rank: number | null
  totalPoints: number
  totalSoftcorePoints: number
  totalTruePoints: number
  richPresence: string | null
  lastGameId: number | null
}

export interface PlayerAward {
  awardedAt: string
  awardType: string
  title: string
  // Les awards de site (Certified Legend, Patreon Supporter) n'ont ni jeu,
  // ni console, ni icone : l'API renvoie null et AwardData vaut 0.
  systemName: string | null
  iconPath: string | null
  isHardcore: boolean
  gameId: number | null
}

export interface PlayerGameProgress {
  gameId: number
  title: string
  systemId: number
  systemName: string
  iconPath: string
  maxPossible: number
  numAwarded: number
  numAwardedHardcore: number
  highestAwardKind: string | null
  mostRecentAwardedDate: string | null
}

export interface LeaderboardUser {
  rank: number
  user: string
  totalPoints: number
  totalTruePoints: number
}

export interface SearchResults {
  games: GameSummary[]
  player: PlayerProfile | null
  systems: SystemSummary[]
}

export interface GameExtras {
  distribution: Array<{ count: number; players: number }>
  topPlayers: Array<{ user: string; numAchievements: number; totalScore: number }>
  leaderboards: Array<{
    id: number
    title: string
    description: string
    topEntry: { user: string; formattedScore: string } | null
  }>
}

export interface AchievementOfTheWeek {
  id: number
  title: string
  description: string
  points: number
  trueRatio: number
  type: AchievementType
  badgeName: string
  gameId: number
  gameTitle: string
  systemName: string
  startAt: string
  totalPlayers: number
  unlocksHardcoreCount: number
}

export interface RecentAward {
  user: string
  awardKind: string
  awardDate: string
  gameId: number
  gameTitle: string
  systemName: string
}

export interface PlayerSummary {
  profile: PlayerProfile
  awards: PlayerAward[]
  awardsTotal: number
  gamesTotal: number
  recentGames: PlayerGameProgress[]
}

export interface PlayerProgressPayload {
  total: number
  results: PlayerGameProgress[]
}

export interface HomePayload {
  achievementOfTheWeek: AchievementOfTheWeek | null
  recentAwards: RecentAward[]
}
