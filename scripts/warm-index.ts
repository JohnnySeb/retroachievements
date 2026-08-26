import { buildIndex } from '../server/search-index'

const started = Date.now()

buildIndex((done, total) => {
  process.stdout.write(`\rIndexing ${done}/${total} systems...`)
})
  .then((games) => {
    const seconds = Math.round((Date.now() - started) / 1000)
    process.stdout.write(
      `\n${games.length} games indexed in ${seconds}s -> .cache/game-index.json\n`,
    )
  })
  .catch((error: unknown) => {
    process.stderr.write(`\nIndexing failed: ${String(error)}\n`)
    process.exitCode = 1
  })
