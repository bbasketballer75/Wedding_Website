import { access, cp, mkdir, rm } from 'fs/promises'
import path from 'path'

const publicImagesDir = path.resolve('public', 'images')
const distImagesDir = path.resolve('dist', 'images')

async function main() {
  try {
    await access(publicImagesDir)
  } catch {
    console.log('Skipped copying public/images; source directory was not found')
    return
  }

  await rm(distImagesDir, { recursive: true, force: true })
  await mkdir(path.dirname(distImagesDir), { recursive: true })
  await cp(publicImagesDir, distImagesDir, { recursive: true })
  console.log('Copied public/images to dist/images')
}

main().catch(error => {
  console.error('Failed to copy public/images into dist:', error)
  process.exitCode = 1
})
