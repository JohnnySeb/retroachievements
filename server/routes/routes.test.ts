import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetCache } from '../cache'
import { createApp } from '../index'
import { setIndex } from '../search-index'

const RAW_ACHIEVEMENT = {
  ID: 9,
  NumAwarded: 54785,
  NumAwardedHardcore: 25640,
  Title: 'That Was Easy',
  Description: 'Complete the first act of Green Hill Zone.',
  Points: 3,
  TrueRatio: 3,
  BadgeName: '250336',
  DisplayOrder: 1,
  type: 'progression',
}

const SONIC_RAW = {
  ID: 1,
  Title: 'Sonic the Hedgehog',
  ConsoleID: 1,
  ConsoleName: 'Genesis/Mega Drive',
  ImageIcon: '/Images/085573.png',
  ImageTitle: '/Images/054993.png',
  ImageIngame: '/Images/000010.png',
  ImageBoxArt: '/Images/112941.png',
  Publisher: 'Sega',
  Developer: 'Sonic Team',
  Genre: '2D Platforming',
  Released: '1991-06-11',
  NumDistinctPlayers: 60727,
  NumAchievements: 1,
  Achievements: { '9': RAW_ACHIEVEMENT },
}

function mockRa(byEndpoint: Record<string, unknown>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input))
    const endpoint = url.pathname.replace('/API/API_', '').replace('.php', '')
    if (!(endpoint in byEndpoint)) return new Response('', { status: 404 })
    return new Response(JSON.stringify(byEndpoint[endpoint]), { status: 200 })
  })
}

describe('internal routes', () => {
  beforeEach(() => {
    process.env.RA_API_KEY = 'test-key'
    resetCache()
    setIndex([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/systems returns normalized systems', async () => {
    mockRa({
      GetConsoleIDs: [
        {
          ID: 1,
          Name: 'Genesis/Mega Drive',
          IconURL: 'https://static.retroachievements.org/assets/images/system/md.png',
          Active: true,
          IsGameSystem: true,
        },
      ],
    })

    const response = await createApp().request('/api/systems')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      {
        id: 1,
        name: 'Genesis/Mega Drive',
        iconUrl: 'https://static.retroachievements.org/assets/images/system/md.png',
      },
    ])
  })

  it('GET /api/games/:id returns a GameDetail with its achievements', async () => {
    mockRa({ GetGameExtended: SONIC_RAW })

    const response = await createApp().request('/api/games/1')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe('Sonic the Hedgehog')
    expect(body.achievements).toHaveLength(1)
    expect(body.achievements[0].unlockRate).toBeCloseTo(90.22, 1)
    expect(body.totalPoints).toBe(3)
  })

  it('GET /api/games/:id rejects a non-numeric id', async () => {
    const response = await createApp().request('/api/games/abc')

    expect(response.status).toBe(400)
  })

  it('GET /api/games/:id returns 404 for an unknown game', async () => {
    mockRa({ GetGameExtended: {} })

    const response = await createApp().request('/api/games/999999')

    expect(response.status).toBe(404)
  })

  it('GET /api/games/:id/extras aggregates distribution, top players and leaderboards', async () => {
    mockRa({
      GetAchievementDistribution: { '2': 51, '1': 141 },
      GetGameRankAndScore: [{ User: 'Scott', NumAchievements: 35, TotalScore: 300 }],
      GetGameLeaderboards: {
        Results: [
          {
            ID: 104370,
            Title: 'Fastest Green Hill',
            Description: 'Speedrun',
            TopEntry: { User: 'Scott', FormattedScore: "0:31.20" },
          },
        ],
      },
    })

    const response = await createApp().request('/api/games/1/extras')
    const body = await response.json()

    expect(body.distribution).toEqual([
      { count: 1, players: 141 },
      { count: 2, players: 51 },
    ])
    expect(body.topPlayers[0].user).toBe('Scott')
    expect(body.leaderboards[0].topEntry.formattedScore).toBe('0:31.20')
  })

  it('GET /api/search answers 503 while the index is empty', async () => {
    const response = await createApp().request('/api/search?q=sonic')
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('indexing')
  })

  it('GET /api/search returns matching games once the index is loaded', async () => {
    setIndex([
      {
        id: 1,
        title: 'Sonic the Hedgehog',
        systemId: 1,
        systemName: 'Genesis/Mega Drive',
        iconPath: '/Images/085573.png',
        numAchievements: 35,
        points: 300,
      },
    ])
    mockRa({ GetConsoleIDs: [], GetUserProfile: {} })

    const response = await createApp().request('/api/search?q=sonic')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.games[0].id).toBe(1)
    expect(body.player).toBeNull()
  })

  it('GET /api/users/:user aggregates profile, awards and recent games', async () => {
    mockRa({
      GetUserProfile: {
        User: 'MaxMilyin',
        ULID: 'X',
        UserPic: '/UserPic/MaxMilyin.png',
        MemberSince: '2016-01-02 00:43:04',
        RichPresenceMsg: 'PUP38 on HorizonXI',
        LastGameID: 28275,
        TotalPoints: 491867,
        TotalSoftcorePoints: 0,
        TotalTruePoints: 2669943,
        Motto: 'LIVE RA',
      },
      GetUserAwards: {
        VisibleUserAwards: [
          {
            AwardedAt: '2026-01-01T00:00:00+00:00',
            AwardType: 'Mastery/Completion',
            AwardData: 1,
            AwardDataExtra: 1,
            Title: 'Sonic the Hedgehog',
            ConsoleName: 'Genesis/Mega Drive',
            ImageIcon: '/Images/085573.png',
          },
        ],
      },
      GetUserCompletionProgress: { Total: 1629 },
      GetUserRecentlyPlayedGames: [
        {
          GameID: 1,
          ConsoleID: 1,
          ConsoleName: 'Genesis/Mega Drive',
          Title: 'Sonic the Hedgehog',
          ImageIcon: '/Images/085573.png',
          LastPlayed: '2026-08-01 12:00:00',
          NumPossibleAchievements: 35,
          NumAchieved: 22,
          NumAchievedHardcore: 16,
        },
      ],
    })

    const response = await createApp().request('/api/users/MaxMilyin')
    const body = await response.json()

    expect(body.profile.user).toBe('MaxMilyin')
    expect(body.awards[0].isHardcore).toBe(true)
    expect(body.recentGames[0].numAwardedHardcore).toBe(16)
    expect(body.gamesTotal).toBe(1629)
  })

  it('GET /api/users/:user maps a site award that has no game', async () => {
    mockRa({
      GetUserProfile: {
        User: 'MaxMilyin', ULID: 'X', UserPic: '/UserPic/MaxMilyin.png',
        MemberSince: '2016-01-02 00:43:04', RichPresenceMsg: 'Unknown', LastGameID: 0,
        TotalPoints: 1, TotalSoftcorePoints: 0, TotalTruePoints: 1, Motto: '',
      },
      GetUserAwards: {
        VisibleUserAwards: [
          // Forme reelle d'un Certified Legend : ni titre, ni console, ni icone.
          {
            AwardedAt: '2024-12-22T21:43:11+00:00', AwardType: 'Certified Legend',
            AwardData: 0, AwardDataExtra: 0, Title: null, ConsoleName: null, ImageIcon: null,
          },
          // AwardDataExtra vaut 2 sur certains evenements : ce n'est pas du hardcore.
          {
            AwardedAt: '2024-04-12T21:32:40+00:00', AwardType: 'Event',
            AwardData: 139, AwardDataExtra: 2, Title: 'On the Horizon',
            ConsoleName: 'Events', ImageIcon: '/Images/088982.png',
          },
        ],
      },
      GetUserRecentlyPlayedGames: [],
    })

    const response = await createApp().request('/api/users/MaxMilyin')
    const body = await response.json()
    // Les awards sont tries du plus recent au plus ancien.
    const [legend, event] = body.awards

    expect(legend.gameId).toBeNull()
    expect(legend.title).toBe('Certified Legend')
    expect(legend.iconPath).toBeNull()
    expect(legend.isHardcore).toBe(false)
    expect(event.gameId).toBe(139)
    expect(event.isHardcore).toBe(false)
  })

  it('GET /api/users/:user/suggestions ranks easy locked achievements first', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input))
      const endpoint = url.pathname.replace('/API/API_', '').replace('.php', '')

      if (endpoint === 'GetUserCompletionProgress') {
        return new Response(
          JSON.stringify({
            Results: [
              // Termine : rien a suggerer.
              { GameID: 1, Title: 'Done', ImageIcon: '/a.png', ConsoleID: 1, ConsoleName: 'X', MaxPossible: 10, NumAwarded: 10, NumAwardedHardcore: 10, MostRecentAwardedDate: null, HighestAwardKind: 'mastered' },
              // Jamais touche : ce n'est pas une reprise.
              { GameID: 2, Title: 'Untouched', ImageIcon: '/b.png', ConsoleID: 1, ConsoleName: 'X', MaxPossible: 10, NumAwarded: 0, NumAwardedHardcore: 0, MostRecentAwardedDate: null, HighestAwardKind: null },
              // En cours : le seul candidat.
              { GameID: 3, Title: 'In progress', ImageIcon: '/c.png', ConsoleID: 1, ConsoleName: 'X', MaxPossible: 10, NumAwarded: 7, NumAwardedHardcore: 7, MostRecentAwardedDate: null, HighestAwardKind: null },
            ],
          }),
          { status: 200 },
        )
      }

      if (endpoint === 'GetGameInfoAndUserProgress') {
        expect(url.searchParams.get('g')).toBe('3')
        return new Response(
          JSON.stringify({
            ...SONIC_RAW,
            NumDistinctPlayers: 100,
            Achievements: {
              '1': { ...RAW_ACHIEVEMENT, ID: 1, NumAwarded: 90, Points: 5, DateEarned: '2026-01-01 00:00:00' },
              '2': { ...RAW_ACHIEVEMENT, ID: 2, NumAwarded: 80, Points: 10 },
              '3': { ...RAW_ACHIEVEMENT, ID: 3, NumAwarded: 5, Points: 50 },
            },
          }),
          { status: 200 },
        )
      }

      return new Response('', { status: 404 })
    })

    const response = await createApp().request('/api/users/MaxMilyin/suggestions')
    const body = await response.json()

    // L'achievement deja obtenu est exclu ; le plus repandu passe devant le plus rare.
    expect(body.map((entry: { id: number }) => entry.id)).toEqual([2, 3])
    expect(body[0].gameTitle).toBe('In progress')
    expect(body[0].gameAwarded).toBe(7)
    expect(body[0].gamePossible).toBe(10)
  })

  it('GET /api/users/:user/suggestions survives an unreachable game', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input))
      const endpoint = url.pathname.replace('/API/API_', '').replace('.php', '')
      if (endpoint === 'GetUserCompletionProgress') {
        return new Response(
          JSON.stringify({
            Results: [
              { GameID: 3, Title: 'Broken', ImageIcon: '/c.png', ConsoleID: 1, ConsoleName: 'X', MaxPossible: 10, NumAwarded: 7, NumAwardedHardcore: 7, MostRecentAwardedDate: null, HighestAwardKind: null },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response('', { status: 500 })
    })

    const response = await createApp().request('/api/users/MaxMilyin/suggestions')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it('GET /api/users/:user returns 404 for an unknown player', async () => {
    mockRa({ GetUserProfile: {} })

    const response = await createApp().request('/api/users/inconnu')

    expect(response.status).toBe(404)
  })

  it('GET /api/users/:user maps an upstream 404 to a 404, not a 502', async () => {
    // L'API RA repond en HTTP 404 pour un pseudo inconnu, pas avec un objet vide.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))

    const response = await createApp().request('/api/users/zzzznotreal')

    expect(response.status).toBe(404)
  })

  it('GET /api/users/:user caps the award wall and reports the real total', async () => {
    const manyAwards = Array.from({ length: 200 }, (_, index) => ({
      AwardedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00+00:00`,
      AwardType: 'Mastery/Completion',
      AwardData: index,
      AwardDataExtra: 1,
      Title: `Jeu ${index}`,
      ConsoleName: 'Genesis/Mega Drive',
      ImageIcon: '/Images/085573.png',
    }))
    mockRa({
      GetUserProfile: {
        User: 'MaxMilyin', ULID: 'X', UserPic: '/UserPic/MaxMilyin.png',
        MemberSince: '2016-01-02 00:43:04', RichPresenceMsg: 'Unknown', LastGameID: 0,
        TotalPoints: 1, TotalSoftcorePoints: 0, TotalTruePoints: 1, Motto: '',
      },
      GetUserAwards: { VisibleUserAwards: manyAwards, TotalAwardsCount: 200 },
      GetUserRecentlyPlayedGames: [],
    })

    const response = await createApp().request('/api/users/MaxMilyin')
    const body = await response.json()

    expect(body.awards).toHaveLength(60)
    expect(body.awardsTotal).toBe(200)
  })

  it('GET /api/games/:id/progress/:user returns the progress', async () => {
    mockRa({
      GetGameInfoAndUserProgress: {
        ...SONIC_RAW,
        NumAwardedToUser: 22,
        NumAwardedToUserHardcore: 16,
        UserCompletion: '62.86%',
        UserCompletionHardcore: '45.71%',
        HighestAwardKind: null,
        Achievements: {
          '9': { ...RAW_ACHIEVEMENT, DateEarnedHardcore: '2026-02-01 10:00:00' },
        },
      },
    })

    const response = await createApp().request('/api/games/1/progress/MaxMilyin')
    const body = await response.json()

    expect(body.progress.numAwardedHardcore).toBe(16)
    expect(body.progress.completionHardcorePct).toBeCloseTo(45.71, 1)
    expect(body.achievements[0].dateEarnedHardcore).toBe('2026-02-01 10:00:00')
  })

  it('GET /api/leaderboards maps the numeric-key shape of GetTopTenUsers', async () => {
    mockRa({
      GetTopTenUsers: [
        { '1': 'Sarconius', '2': 591709, '3': 4582410, '4': 'ULID' },
        { '1': 'MaxMilyin', '2': 491867, '3': 2669943, '4': 'ULID' },
      ],
    })

    const response = await createApp().request('/api/leaderboards')
    const body = await response.json()

    expect(body[0]).toEqual({
      rank: 1,
      user: 'Sarconius',
      totalPoints: 591709,
      totalTruePoints: 4582410,
    })
  })

  it('GET /api/home degrades to empty highlights when the upstream extras fail', async () => {
    mockRa({})

    const response = await createApp().request('/api/home')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.achievementOfTheWeek).toBeNull()
    expect(body.recentAwards).toEqual([])
  })

  it('GET /api/home maps the achievement of the week', async () => {
    mockRa({
      GetAchievementOfTheWeek: {
        Achievement: {
          ID: 31931,
          Title: 'Here Stands A Brave Man',
          Description: 'Agree to be photographed.',
          Points: 5,
          TrueRatio: 8,
          Type: 'missable',
          BadgeName: '689317',
        },
        Console: { Title: 'Game Boy Color' },
        Game: { ID: 5371, Title: "The Legend of Zelda: Link's Awakening DX" },
        StartAt: '2026-08-24T00:00:00.000000Z',
        TotalPlayers: 4484,
        UnlocksHardcoreCount: 500,
      },
      GetRecentGameAwards: {
        Results: [
          {
            User: 'WellesR5',
            AwardKind: 'mastered',
            AwardDate: '2026-08-26T20:22:54+00:00',
            GameID: 37923,
            GameTitle: '~Homebrew~ Bees',
            ConsoleName: 'Atari 2600',
          },
        ],
      },
    })

    const response = await createApp().request('/api/home')
    const body = await response.json()

    expect(body.achievementOfTheWeek.title).toBe('Here Stands A Brave Man')
    expect(body.achievementOfTheWeek.type).toBe('missable')
    expect(body.achievementOfTheWeek.gameId).toBe(5371)
    expect(body.recentAwards[0].awardKind).toBe('mastered')
  })
})
