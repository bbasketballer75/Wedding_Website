import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Rolldown ships a JS package plus one optional native binding per platform. The JS
 * shim calls into that binary, so the two MUST be the same version.
 *
 * When they diverge the failure is platform-specific and confusing: Windows and macOS
 * build fine, and only Linux CI dies with
 *
 *   [plugin vite:build-html]
 *   TypeError: bindingChunk.getCodeIdentity is not a function
 *
 * That is exactly what blocked the vite 8.3.8 upgrade -- package.json pinned four linux
 * bindings to 1.2.15 while vite 8.3.8 resolved rolldown 1.2.19.
 *
 * Runs on every `npm run test:run`, so drift fails as a named assertion naming the
 * binding, rather than a stack trace from inside rolldown.
 */

// vitest runs with the repository root as cwd
const ROOT = process.cwd()

type LockEntry = { version?: string }
type Lock = { packages?: Record<string, LockEntry> }

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as T
}

function bindingEntries(lock: Lock): Array<[string, string]> {
  const packages = lock.packages ?? {}
  return Object.entries(packages)
    .filter(([path]) => /^node_modules\/@rolldown\/binding-[^/]+$/.test(path))
    .map(([path, entry]) => [path.replace('node_modules/', ''), entry.version ?? ''])
}

describe('rolldown native bindings match the JS shim', () => {
  const lock = readJson<Lock>('package-lock.json')
  const rolldown = lock.packages?.['node_modules/rolldown']?.version
  const bindings = bindingEntries(lock)

  it('records a rolldown version to compare against', () => {
    // If rolldown ever stops being installed this should be updated deliberately,
    // not silently skipped.
    expect(rolldown, 'node_modules/rolldown missing from package-lock.json').toBeTruthy()
  })

  it('resolves every platform binding to the same version as rolldown', () => {
    const mismatched = bindings.filter(([, version]) => version !== rolldown)
    expect(
      mismatched,
      mismatched.length
        ? `native bindings disagree with rolldown ${rolldown}:\n${mismatched
            .map(([name, v]) => `  ${name} is ${v}`)
            .join('\n')}\nLinux CI loads one of these and fails with ` +
            `"bindingChunk.getCodeIdentity is not a function". Remove any @rolldown/binding-* ` +
            `entry from package.json overrides and regenerate the lockfile.`
        : ''
    ).toEqual([])
  })

  it('does not pin any rolldown binding in package.json overrides', () => {
    const pkg = readJson<{ overrides?: Record<string, string> }>('package.json')
    const pinned = Object.keys(pkg.overrides ?? {}).filter(key =>
      key.startsWith('@rolldown/binding-')
    )
    expect(
      pinned,
      pinned.length
        ? `package.json overrides pin ${pinned.join(', ')}. An override on a native binding ` +
            'freezes that platform while the JS shim moves on -- that is how the vite 8.3.8 ' +
            'upgrade broke Linux only. Drop the override instead.'
        : ''
    ).toEqual([])
  })
})
