/**
 * CLI: static gzip server for `run.mjs --serve-dist` (also usable standalone).
 *
 * Usage:
 *   node tools/perf/lib/server.mjs --dir rebuild/dist [--port 4180] [--compression gzip|brotli|none]
 *
 * Normally you do not need this directly: `node tools/perf/run.mjs --serve-dist rebuild/dist`
 * starts it on an ephemeral port and measures against it in the same process.
 */
import path from 'node:path'
import { isMainModule, log, repoRoot } from './util.mjs'
import { startStaticServer } from './server.mjs'

async function main(argv) {
  const options = { dir: path.join(repoRoot, 'rebuild', 'dist'), port: 0, compression: 'gzip' }
  const args = [...argv]
  const readValue = flag => {
    const value = args.shift()
    if (value === undefined) throw new Error(`${flag} needs a value`)
    return value
  }
  while (args.length > 0) {
    const argument = args.shift()
    if (argument === '--dir') options.dir = path.resolve(readValue(argument))
    else if (argument === '--port') options.port = Number(readValue(argument))
    else if (argument === '--compression') options.compression = readValue(argument)
    else throw new Error(`unknown argument "${argument}"`)
  }
  const server = await startStaticServer(options)
  log.ok(`serving ${options.dir} with ${options.compression} at ${server.url}`)
  process.on('SIGINT', () => {
    void server.close().then(() => process.exit(0))
  })
  return null
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    log.fail(error.message)
    process.exitCode = 2
  })
}
