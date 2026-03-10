import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PUBLIC_DIR = path.join(__dirname, '../public/images')

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map(dirent => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    })
  )
  return Array.prototype.concat(...files)
}

async function convertImages() {
  try {
    const files = await getFiles(PUBLIC_DIR)

    for (const inputPath of files) {
      if (inputPath.match(/\.(jpg|jpeg|png)$/i)) {
        const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp')

        // Check if WebP already exists
        try {
          await fs.access(outputPath)
          // console.log(`Skipping ${path.basename(inputPath)} - WebP exists`);
          continue
        } catch {
          // Process
        }

        console.log(`Converting ${path.basename(inputPath)} to WebP...`)
        await sharp(inputPath).webp({ quality: 80 }).toFile(outputPath)
      }
    }
    console.log('Recursive image conversion complete!')
  } catch (error) {
    console.error('Error converting images:', error)
  }
}

convertImages()
