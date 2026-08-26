import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { getEnv } from './env'
import { gamesRoutes } from './routes/games'
import { homeRoutes } from './routes/home'
import { leaderboardsRoutes } from './routes/leaderboards'
import { searchRoutes } from './routes/search'
import { systemsRoutes } from './routes/systems'
import { usersRoutes } from './routes/users'
import { loadIndex } from './search-index'

export function createApp(): Hono {
  const app = new Hono()

  app.route('/api', homeRoutes)
  app.route('/api', systemsRoutes)
  app.route('/api', gamesRoutes)
  app.route('/api', usersRoutes)
  app.route('/api', searchRoutes)
  app.route('/api', leaderboardsRoutes)

  app.onError((error, context) => {
    const status = (error as { status?: number }).status
    return context.json({ error: error.message }, status === 429 ? 429 : 502)
  })

  return app
}

const isEntryPoint = process.argv[1]?.includes('server/index.ts')

if (isEntryPoint) {
  const { port } = getEnv()
  const app = createApp()

  app.use('/assets/*', serveStatic({ root: './dist' }))
  app.get('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))

  void loadIndex().then((ready) => {
    if (!ready) {
      process.stdout.write('Search index missing. Run `npm run warm`.\n')
    }
  })

  serve({ fetch: app.fetch, port })
  process.stdout.write(`API on http://localhost:${port}\n`)
}
