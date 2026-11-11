/**
 * Writes generated contract JSON in the exact format `npx prettier --check`
 * expects.
 *
 * The repo formats committed JSON with Prettier (see .prettierrc + format:check
 * in package.json). A generator that wrote raw `JSON.stringify(..., 2)` output
 * would make every regeneration produce a formatting-only diff, which would break
 * the "re-running a generator is byte-identical" rule. So generators format
 * through Prettier itself: same parser, same resolved config, one output.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as prettier from 'prettier'

/**
 * @param {string} file absolute output path (also used to resolve .prettierrc)
 * @param {unknown} value JSON-serializable contract payload
 */
export async function writeContractJson(file, value) {
  const options = (await prettier.resolveConfig(file)) ?? {}
  const text = await prettier.format(JSON.stringify(value), { ...options, parser: 'json' })
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text, 'utf8')
}
