// @ts-nocheck
import { ZodError, ZodSchema } from 'zod'

/**
 * Format Zod validation errors into user-friendly messages
 */
export function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}

  error.errors.forEach(err => {
    const path = err.path.join('.')
    errors[path] = err.message
  })

  return errors
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: ZodError): string {
  return error.errors[0]?.message || 'Validation error'
}

/**
 * Validate data and return formatted errors
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  }
}

/**
 * Create form field error getter
 */
export function createFieldErrorGetter(errors: Record<string, string>) {
  return (field: string): string | undefined => errors[field]
}

/**
 * Check if field has error
 */
export function hasFieldError(errors: Record<string, string>, field: string): boolean {
  return field in errors
}

/**
 * Get all error messages as array
 */
export function getAllErrors(errors: Record<string, string>): string[] {
  return Object.values(errors)
}

/**
 * Combine multiple error objects
 */
export function combineErrors(...errorObjects: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...errorObjects)
}

export default {
  formatZodErrors,
  getFirstError,
  validateData,
  createFieldErrorGetter,
  hasFieldError,
  getAllErrors,
  combineErrors,
}
