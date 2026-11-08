import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DATA_ERROR_MESSAGE,
  DataError,
  isDataError,
  toDataError,
  unwrapNullableResult,
  unwrapResult,
} from './errors'

describe('DataError', () => {
  it('defaults to a user-safe message and unknown code', () => {
    const error = new DataError()

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('DataError')
    expect(error.message).toBe(DEFAULT_DATA_ERROR_MESSAGE)
    expect(error.code).toBe('unknown')
    expect(error.cause).toBeUndefined()
  })

  it('keeps an explicit safe message, code and cause', () => {
    const cause = new Error('raw')
    const error = new DataError({ message: 'Safe text', code: 'postgrest:42501', cause })

    expect(error.message).toBe('Safe text')
    expect(error.code).toBe('postgrest:42501')
    expect(error.cause).toBe(cause)
  })

  it('isDataError recognises only DataError instances', () => {
    expect(isDataError(new DataError())).toBe(true)
    expect(isDataError(new Error('x'))).toBe(false)
    expect(isDataError(null)).toBe(false)
    expect(isDataError('DataError')).toBe(false)
  })
})

describe('toDataError error normalisation', () => {
  it('passes a DataError through unchanged (no double wrapping)', () => {
    const original = new DataError({ message: 'already safe', code: 'auth' })
    expect(toDataError(original, 'fallback')).toBe(original)
  })

  it('maps a PostgREST error: safe fallback message, machine code, raw cause preserved', () => {
    const raw = {
      message: 'new row violates row-level security policy',
      code: '42501',
      details: {},
    }
    const error = toDataError(raw, 'Please sign in to manage content.')

    expect(error.message).toBe('Please sign in to manage content.')
    expect(error.message).not.toContain('row-level security')
    expect(error.code).toBe('postgrest:42501')
    expect(error.cause).toBe(raw)
  })

  it('maps PGRST codes (0-row single, JWT expired)', () => {
    expect(toDataError({ message: 'no rows', code: 'PGRST116' }).code).toBe('postgrest:PGRST116')
    expect(toDataError({ message: 'jwt', code: 'PGRST301' }).code).toBe('postgrest:PGRST301')
  })

  it('maps HTTP-ish and auth errors', () => {
    expect(toDataError({ message: 'nope', status: 401 }).code).toBe('http:401')
    expect(toDataError({ message: 'bad login', name: 'AuthApiError' }).code).toBe('auth')
  })

  it('maps network failures and treats everything else as unknown', () => {
    const network = new TypeError('Failed to fetch')
    expect(toDataError(network).code).toBe('network')
    expect(toDataError(new Error('boom')).code).toBe('unknown')
    expect(toDataError('string error').code).toBe('unknown')
    expect(toDataError(undefined).code).toBe('unknown')
  })

  it('falls back to the default safe message when no fallback is supplied', () => {
    const error = toDataError(new Error('raw internal detail'))
    expect(error.message).toBe(DEFAULT_DATA_ERROR_MESSAGE)
    expect(error.message).not.toContain('raw internal detail')
  })
})

describe('result unwrapping', () => {
  it('unwrapResult returns data and throws normalised errors', () => {
    expect(unwrapResult({ data: 42, error: null })).toBe(42)

    const raw = { message: 'permission denied for table photos', code: '42501' }
    expect(() => unwrapResult({ data: null, error: raw }, 'Could not load.')).toThrowError(
      DataError
    )

    try {
      unwrapResult({ data: null, error: raw }, 'Could not load.')
    } catch (error) {
      expect(isDataError(error)).toBe(true)
      if (isDataError(error)) {
        expect(error.code).toBe('postgrest:42501')
        expect(error.message).toBe('Could not load.')
      }
    }
  })

  it('unwrapNullableResult treats PGRST116 as absence, other errors as failures', () => {
    expect(unwrapNullableResult({ data: null, error: null })).toBeNull()
    expect(unwrapNullableResult({ data: { id: '1' }, error: null })).toEqual({ id: '1' })
    expect(
      unwrapNullableResult({ data: null, error: { message: 'no rows', code: 'PGRST116' } })
    ).toBeNull()

    expect(() =>
      unwrapNullableResult({ data: null, error: { message: 'denied', code: '42501' } })
    ).toThrowError(DataError)
  })
})
