import { z } from 'zod'

/**
 * Guest Book validation schemas
 */

export const createGuestBookEntrySchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    message: z
      .string()
      .min(10, 'Message must be at least 10 characters')
      .max(1000, 'Message must be less than 1000 characters')
      .trim(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    photo: z.string().url('Invalid photo URL').optional().or(z.literal('')),
  })
  .strict()

export const guestBookFilterSchema = z
  .object({
    approved: z.boolean().optional(),
  })
  .strict()

export const guestBookEntrySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    message: z.string(),
    email: z.string().email().optional(),
    photo: z.string().url().optional(),
    approved: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict()

export const guestBookEntryArraySchema = z.array(guestBookEntrySchema)

/**
 * Type exports
 */
export type CreateGuestBookEntry = z.infer<typeof createGuestBookEntrySchema>
export type GuestBookFilter = z.infer<typeof guestBookFilterSchema>
export type GuestBookEntry = z.infer<typeof guestBookEntrySchema>

/**
 * Validation helpers
 */
export const validateCreateGuestBookEntry = (data: unknown) => {
  return createGuestBookEntrySchema.safeParse(data)
}

export const validateGuestBookFilter = (data: unknown) => {
  return guestBookFilterSchema.safeParse(data)
}

export const validateGuestBookEntry = (data: unknown) => {
  return guestBookEntrySchema.safeParse(data)
}

export const validateGuestBookEntryArray = (data: unknown) => {
  return guestBookEntryArraySchema.safeParse(data)
}
