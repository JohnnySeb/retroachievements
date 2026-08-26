import { Hono } from 'hono'

import type { PlayerProfile, SearchResults } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { type RaUserProfile, normalizePlayerProfile } from '../normalize'
import { fetchRaOrNull } from '../ra-client'
import { getIndexStatus, searchGames, searchSystems } from '../search-index'
import { loadSystems } from './systems'

async function findPlayer(query: string): Promise<PlayerProfile | null> {
  // Un pseudo inconnu n'est pas une erreur de recherche : la section joueur reste vide.
  return cached(`search-user:${query}`, TTL.user, async () => {
    const raw = await fetchRaOrNull<RaUserProfile>('GetUserProfile', { u: query })
    return raw?.User ? normalizePlayerProfile(raw) : null
  })
}

export const searchRoutes = new Hono()

searchRoutes.get('/search', async (context) => {
  const query = (context.req.query('q') ?? '').trim()
  if (!query) {
    return context.json({ games: [], player: null, systems: [] } satisfies SearchResults)
  }

  const status = getIndexStatus()
  if (!status.ready) {
    return context.json({ status: 'indexing', total: status.total }, 503)
  }

  const [player, systems] = await Promise.all([findPlayer(query), loadSystems()])

  return context.json({
    games: searchGames(query),
    player,
    systems: searchSystems(query, systems),
  } satisfies SearchResults)
})
