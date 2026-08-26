import { readFileSync } from 'node:fs'

function loadDotEnv(): void {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match?.[1] && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2]
      }
    }
  } catch {
    // .env absent : les variables peuvent venir de l'environnement du process.
  }
}

loadDotEnv()

export function getEnv(): { raApiKey: string; port: number } {
  const raApiKey = process.env.RA_API_KEY
  if (!raApiKey) {
    throw new Error(
      'RA_API_KEY is missing. Copy .env.example to .env and fill in your RetroAchievements Web API key.',
    )
  }
  return { raApiKey, port: Number(process.env.PORT ?? 3001) }
}
