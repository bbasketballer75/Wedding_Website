import { describe, expect, it } from 'vitest'
import { isJsonObject, readJsonNumber, readJsonNumberOr, readJsonString } from './schema'

describe('JSON value helpers', () => {
  it('isJsonObject accepts plain objects only', () => {
    expect(isJsonObject({ a: 1 })).toBe(true)
    expect(isJsonObject({})).toBe(true)
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject(null)).toBe(false)
    expect(isJsonObject(undefined)).toBe(false)
    expect(isJsonObject('text')).toBe(false)
    expect(isJsonObject(3)).toBe(false)
  })

  it('readJsonString returns a string or null', () => {
    expect(readJsonString({ name: 'Austin' }, 'name')).toBe('Austin')
    expect(readJsonString({ name: 3 }, 'name')).toBeNull()
    expect(readJsonString({}, 'name')).toBeNull()
  })

  it('readJsonNumber returns a finite number or null', () => {
    expect(readJsonNumber({ x: 0.5 }, 'x')).toBe(0.5)
    expect(readJsonNumber({ x: '0.5' }, 'x')).toBeNull()
    expect(readJsonNumber({ x: Number.NaN }, 'x')).toBeNull()
    expect(readJsonNumber({}, 'x')).toBeNull()
  })

  it('readJsonNumberOr falls back only when absent/mistyped', () => {
    expect(readJsonNumberOr({ y: 0 }, 'y', 7)).toBe(0)
    expect(readJsonNumberOr({}, 'y', 7)).toBe(7)
    expect(readJsonNumberOr({ y: null }, 'y', 7)).toBe(7)
  })
})
