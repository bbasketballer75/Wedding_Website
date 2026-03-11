import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['vite', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ANALYZE: 'true',
  },
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
