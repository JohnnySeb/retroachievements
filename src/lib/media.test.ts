import { describe, expect, it } from 'vitest'

import { badgeUrl, mediaUrl } from './media'

describe('mediaUrl', () => {
  it('prefixes a relative path with the media base', () => {
    expect(mediaUrl('/Images/112941.png')).toBe(
      'https://media.retroachievements.org/Images/112941.png',
    )
  })

  it('adds the missing leading slash', () => {
    expect(mediaUrl('Images/112941.png')).toBe(
      'https://media.retroachievements.org/Images/112941.png',
    )
  })

  it('leaves an absolute URL untouched', () => {
    const absolute = 'https://static.retroachievements.org/assets/images/system/md.png'
    expect(mediaUrl(absolute)).toBe(absolute)
  })

  it('returns an empty string when the path is missing', () => {
    expect(mediaUrl(null)).toBe('')
    expect(mediaUrl(undefined)).toBe('')
    expect(mediaUrl('')).toBe('')
  })
})

describe('badgeUrl', () => {
  it('builds the unlocked badge URL', () => {
    expect(badgeUrl('250336', true)).toBe('https://media.retroachievements.org/Badge/250336.png')
  })

  it('uses the _lock variant when locked', () => {
    expect(badgeUrl('250336', false)).toBe(
      'https://media.retroachievements.org/Badge/250336_lock.png',
    )
  })
})
