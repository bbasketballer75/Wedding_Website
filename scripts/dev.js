/* global process */
import { exec, spawn } from 'child_process'
import os from 'os'

const isWindows = os.platform() === 'win32'
const port = 5173

async function killPort(port) {
  return new Promise(resolve => {
    const command = isWindows ? `netstat -ano | findstr :${port}` : `lsof -ti:${port}`

    exec(command, (error, stdout) => {
      if (!stdout) {
        resolve()
        return
      }

      const pids = stdout
        .trim()
        .split('\n')
        .map(line => {
          if (isWindows) {
            const match = line.match(/\s+(\d+)$/)
            return match ? match[1] : null
          } else {
            return line.trim()
          }
        })
        .filter(pid => pid)

      if (pids.length === 0) {
        resolve()
        return
      }

      const killCommand = isWindows
        ? `taskkill /F /PID ${pids.join(' /PID ')}`
        : `kill -9 ${pids.join(' ')}`

      exec(killCommand, () => {
        // Give processes a moment to terminate
        setTimeout(resolve, 1000)
      })
    })
  })
}

async function startDev() {
  console.log('🔧 Checking for processes on port', port)
  await killPort(port)

  console.log('🚀 Starting Vite development server...')

  const vite = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true,
  })

  process.on('SIGINT', () => {
    vite.kill('SIGINT')
    process.exit()
  })
}

startDev().catch(console.error)
