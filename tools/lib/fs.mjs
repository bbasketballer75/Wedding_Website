/**
 * Filesystem helpers shared by workbench scripts.
 */
import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function fileExists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

export async function readJsonIfExists(file) {
  try {
    return await readJson(file)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function readText(file) {
  return await readFile(file, 'utf8')
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeText(file, text) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text, 'utf8')
}

export async function listFiles(directory, { recursive = false } = {}) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (recursive) files.push(...(await listFiles(fullPath, { recursive })))
      continue
    }
    if (entry.isFile()) files.push(fullPath)
  }

  return files
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
