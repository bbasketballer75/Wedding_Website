/* eslint-disable no-undef -- Node CLI script; the app flat config declares browser/node globals only for TS files. */
/**
 * Opt-in local-Supabase contract test runner.
 *
 * Wave 8's `vitest.config.ts` defines deterministic `VITE_*` test env values, and
 * Vitest's `test.env` overrides shell environment variables. That means the old
 * recipe (exporting VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) no longer reaches
 * the contract suite — its canonical env pairs are SUPABASE_CONTRACT_URL /
 * SUPABASE_CONTRACT_ANON_KEY. This wrapper sets them up for one command:
 *
 *   SUPABASE_CONTRACT_URL=http://127.0.0.1:55321 \
 *   SUPABASE_CONTRACT_ANON_KEY=<anon key> \
 *   npm run test:contract
 *
 * It skips cleanly (exit 0, suite skipped) when the opt-in vars are absent.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const rebuildRoot = path.resolve(here, '..')

const url = process.env.SUPABASE_CONTRACT_URL
const anonKey = process.env.SUPABASE_CONTRACT_ANON_KEY

if (!url || !anonKey) {
  console.log(
    [
      'Local Supabase contract test is opt-in.',
      '',
      '  1. start the sandbox (Wave 0 recipe):',
      '       npx supabase --workdir tmp/supabase-sandbox start',
      '       npx supabase --workdir tmp/supabase-sandbox db reset',
      '  2. point this runner at the sandbox REST API + anon key:',
      '       $env:SUPABASE_CONTRACT_URL = "http://127.0.0.1:55321"',
      '       $env:SUPABASE_CONTRACT_ANON_KEY = "<anon key from supabase status -o env>"',
      '       npm run test:contract',
      '',
      'Without those variables the suite is skipped by design.',
    ].join('\n')
  )
  process.exit(0)
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['vitest', 'run', 'src/shared/data/contract.test.ts'], {
  cwd: rebuildRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_CONTRACT_TEST: '1',
    SUPABASE_CONTRACT_URL: url,
    SUPABASE_CONTRACT_ANON_KEY: anonKey,
  },
})

process.exit(result.status ?? 1)
