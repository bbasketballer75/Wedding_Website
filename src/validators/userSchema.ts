import { z } from 'zod'

/**
 * User validation schemas
 */

export const userSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email('Invalid email address'),
    name: z.string().min(1).max(100).optional(),
    role: z.enum(['user', 'admin', 'moderator']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export const loginSchema = z
  .object({
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters'),
  })
  .strict()

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim()
      .optional(),
    email: z.string().email('Invalid email address').optional(),
  })
  .strict()

/**
 * Type exports
 */
export type User = z.infer<typeof userSchema>
export type Login = z.infer<typeof loginSchema>
export type Register = z.infer<typeof registerSchema>
export type UpdateProfile = z.infer<typeof updateProfileSchema>

/**
 * Validation helpers
 */
export const validateUser = (data: unknown) => {
  return userSchema.safeParse(data)
}

export const validateLogin = (data: unknown) => {
  return loginSchema.safeParse(data)
}

export const validateRegister = (data: unknown) => {
  return registerSchema.safeParse(data)
}

export const validateUpdateProfile = (data: unknown) => {
  return updateProfileSchema.safeParse(data)
}
