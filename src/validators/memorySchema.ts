import { z } from 'zod'

/**
 * Memory validation schemas
 */

export const createMemorySchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    message: z
      .string()
      .min(10, 'Memory must be at least 10 characters')
      .max(2000, 'Memory must be less than 2000 characters')
      .trim(),
    photo: z.string().url('Invalid photo URL').optional().or(z.literal('')),
  })
  .strict()

export const memorySchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().optional(),
    name: z.string(),
    message: z.string(),
    photo: z.string().url().optional(),
    approved: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict()

export const memoryArraySchema = z.array(memorySchema)

/**
 * Type exports
 */
export type CreateMemory = z.infer<typeof createMemorySchema>
export type Memory = z.infer<typeof memorySchema>

/**
 * Validation helpers
 */
export const validateCreateMemory = (data: unknown) => {
  return createMemorySchema.safeParse(data)
}

export const validateMemory = (data: unknown) => {
  return memorySchema.safeParse(data)
}

export const validateMemoryArray = (data: unknown) => {
  return memoryArraySchema.safeParse(data)
}
