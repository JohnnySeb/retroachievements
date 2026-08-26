import { describe, expect, it } from 'vitest'

import { normalizeAchievement, normalizeGameDetail, normalizePlayerProfile } from './normalize'

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

const RAW_GAME = {
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

describe('normalizeAchievement', () => {
  it('computes unlock rates as percentages', () => {
    const result = normalizeAchievement(RAW_ACHIEVEMENT, 60727)

    expect(result.unlockRate).toBeCloseTo(90.22, 1)
    expect(result.unlockRateHardcore).toBeCloseTo(42.22, 1)
  })

  it('returns 0 rather than NaN when there are no distinct players', () => {
    const result = normalizeAchievement(RAW_ACHIEVEMENT, 0)

    expect(result.unlockRate).toBe(0)
    expect(result.unlockRateHardcore).toBe(0)
  })

  it('maps the lowercase type field to the internal type', () => {
    expect(normalizeAchievement(RAW_ACHIEVEMENT, 1).type).toBe('progression')
    expect(normalizeAchievement({ ...RAW_ACHIEVEMENT, type: '' }, 1).type).toBeNull()
    expect(normalizeAchievement({ ...RAW_ACHIEVEMENT, type: undefined }, 1).type).toBeNull()
    expect(normalizeAchievement({ ...RAW_ACHIEVEMENT, type: 'nonsense' }, 1).type).toBeNull()
  })

  it('reads the capitalised Type field used by GetGameInfoAndUserProgress', () => {
    const { type: _lowercase, ...withoutLowercase } = RAW_ACHIEVEMENT

    expect(normalizeAchievement({ ...withoutLowercase, Type: 'missable' }, 1).type).toBe('missable')
  })

  it('prefers the lowercase field when both are present', () => {
    expect(
      normalizeAchievement({ ...RAW_ACHIEVEMENT, Type: 'missable' }, 1).type,
    ).toBe('progression')
  })

  it('exposes earn dates when present', () => {
    const withProgress = { ...RAW_ACHIEVEMENT, DateEarnedHardcore: '2026-02-01 10:00:00' }

    expect(normalizeAchievement(withProgress, 1).dateEarnedHardcore).toBe('2026-02-01 10:00:00')
    expect(normalizeAchievement(RAW_ACHIEVEMENT, 1).dateEarnedHardcore).toBeNull()
  })
})

describe('normalizeGameDetail', () => {
  it('flattens the achievements map into an array sorted by displayOrder', () => {
    const second = { ...RAW_ACHIEVEMENT, ID: 2, DisplayOrder: 0, BadgeName: '250352' }
    const result = normalizeGameDetail({
      ...RAW_GAME,
      Achievements: { '9': RAW_ACHIEVEMENT, '2': second },
    })

    expect(result.achievements.map((entry) => entry.id)).toEqual([2, 9])
  })

  it('sums the set points', () => {
    expect(normalizeGameDetail(RAW_GAME).totalPoints).toBe(3)
  })

  it('keeps media paths relative', () => {
    expect(normalizeGameDetail(RAW_GAME).boxArtPath).toBe('/Images/112941.png')
  })

  it('tolerates a game with no achievements', () => {
    const result = normalizeGameDetail({ ...RAW_GAME, Achievements: {} })

    expect(result.achievements).toEqual([])
    expect(result.totalPoints).toBe(0)
    expect(result.numAchievements).toBe(0)
  })
})

describe('normalizePlayerProfile', () => {
  it('maps the profile fields', () => {
    const result = normalizePlayerProfile({
      User: 'MaxMilyin',
      ULID: '01A7ZWK9Z6K4S6WNNNA418A60H',
      UserPic: '/UserPic/MaxMilyin.png',
      MemberSince: '2016-01-02 00:43:04',
      RichPresenceMsg: 'PUP38/WAR19 on HorizonXI',
      LastGameID: 28275,
      TotalPoints: 491867,
      TotalSoftcorePoints: 0,
      TotalTruePoints: 2669943,
      Motto: 'LIVE RA at twitch.tv/gamesquadsquad',
    })

    expect(result.user).toBe('MaxMilyin')
    expect(result.totalTruePoints).toBe(2669943)
    expect(result.richPresence).toBe('PUP38/WAR19 on HorizonXI')
  })

  it('returns a null rank because GetUserProfile does not expose one', () => {
    const result = normalizePlayerProfile({
      User: 'x', ULID: 'y', UserPic: '/UserPic/x.png', MemberSince: '2020-01-01 00:00:00',
      RichPresenceMsg: '', LastGameID: 0, TotalPoints: 0, TotalSoftcorePoints: 0,
      TotalTruePoints: 0, Motto: '',
    })

    expect(result.rank).toBeNull()
  })

  it('normalizes an absent rich presence to null', () => {
    const result = normalizePlayerProfile({
      User: 'x',
      ULID: 'y',
      UserPic: '/UserPic/x.png',
      MemberSince: '2020-01-01 00:00:00',
      RichPresenceMsg: 'Unknown',
      LastGameID: 0,
      TotalPoints: 0,
      TotalSoftcorePoints: 0,
      TotalTruePoints: 0,
      Motto: '',
    })

    expect(result.richPresence).toBeNull()
    expect(result.lastGameId).toBeNull()
  })
})
