/**
 * Minimal, dependency-free logging for workbench scripts.
 *
 * Every script prints the same shape so CI logs and checkpoint evidence are
 * easy to read: a step header, indented results, and a one-line summary.
 */
const PREFIX = {
  step: '>',
  ok: '+',
  warn: '!',
  fail: 'x',
  info: '-',
}

export const step = message => console.log(`\n${PREFIX.step} ${message}`)
export const ok = message => console.log(`  ${PREFIX.ok} ${message}`)
export const info = message => console.log(`  ${PREFIX.info} ${message}`)
export const warn = message => console.log(`  ${PREFIX.warn} ${message}`)
export const fail = message => console.error(`  ${PREFIX.fail} ${message}`)

export function die(message, code = 1) {
  fail(message)
  process.exit(code)
}

export function summary(label, counts) {
  const parts = Object.entries(counts).map(([key, value]) => `${value} ${key}`)
  console.log(`\n${label}: ${parts.join(', ')}`)
}
