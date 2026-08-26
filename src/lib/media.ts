const MEDIA_BASE = 'https://media.retroachievements.org'

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${MEDIA_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function badgeUrl(badgeName: string, unlocked: boolean): string {
  return `${MEDIA_BASE}/Badge/${badgeName}${unlocked ? '' : '_lock'}.png`
}
