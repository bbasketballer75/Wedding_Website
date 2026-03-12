import 'dotenv/config'
import { access, rm } from 'fs/promises'
import path from 'path'

const OFFLOADED_DIST_DIRS = ['video', 'background_audio', 'media']
const distRoot = path.resolve('dist')
const mediaBaseUrl = process.env.VITE_MEDIA_BASE_URL?.trim()

async function pruneDistDirectory(directory) {
  const target = path.join(distRoot, directory)

  try {
    await access(target)
    await rm(target, { recursive: true, force: true })
    console.log(`Removed dist/${directory} because VITE_MEDIA_BASE_URL is configured`)
  } catch {
    console.log(`Skipped dist/${directory}; nothing to remove`)
  }
}

async function main() {
  if (!mediaBaseUrl) {
    console.log('VITE_MEDIA_BASE_URL not set; keeping local media in dist')
    return
  }

  for (const directory of OFFLOADED_DIST_DIRS) {
    await pruneDistDirectory(directory)
  }
}

main().catch(error => {
  console.error('Failed to prune local media from dist:', error)
  process.exitCode = 1
})
