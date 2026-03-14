import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const sourceRoot = process.argv[2]
const workingRoot = process.argv[3]

if (!sourceRoot || !workingRoot) {
  console.error('Usage: node scripts/prepare-photo-batch.mjs <source-root> <working-root>')
  process.exit(1)
}

async function run(scriptName, args) {
  const scriptPath = path.resolve('scripts', scriptName)
  console.log(`\n> node ${path.relative(process.cwd(), scriptPath)} ${args.join(' ')}`)
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    maxBuffer: 1024 * 1024 * 16,
  })
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
}

async function main() {
  const absoluteSourceRoot = path.resolve(sourceRoot)
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const catalogRoot = path.join(absoluteWorkingRoot, 'catalog')
  const organizedRoot = path.join(absoluteWorkingRoot, 'organized')
  const optimizedRoot = path.join(absoluteWorkingRoot, 'optimized')

  await run('catalog-photo-batch.mjs', [absoluteSourceRoot, catalogRoot])
  await run('analyze-photo-batch.mjs', [absoluteSourceRoot, catalogRoot])
  await run('face-enrich-photo-batch.mjs', [absoluteSourceRoot, absoluteWorkingRoot])
  await run('organize-photo-batch.mjs', [absoluteSourceRoot, absoluteWorkingRoot])
  await run('optimize-photo-batch.mjs', [organizedRoot, optimizedRoot])
  await run('export-photo-import-manifest.mjs', [absoluteWorkingRoot])
}

await main()
