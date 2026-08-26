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
import { getRefreshState, startIndexRefresh } from './index-refresh'
import { getIndexStatus } from './search-index'

export function createApp(): Hono {
  const app = new Hono()

  // Sonde d'hebergeur : ne doit jamais appeler l'API amont ni dependre de l'index.
  app.get('/api/health', (context) =>
    context.json({ status: 'ok', index: getIndexStatus(), refresh: getRefreshState() }),
  )

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
  app.use('/favicon.svg', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))

  // Le systeme de fichiers de Render est ephemere : l'index disparait a chaque
  // redemarrage, donc le serveur le reconstruit lui-meme au demarrage puis chaque jour.
  void startIndexRefresh()

  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
  process.stdout.write(`API on http://0.0.0.0:${port}\n`)
}
