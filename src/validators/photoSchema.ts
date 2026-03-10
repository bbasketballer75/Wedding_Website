import { z } from 'zod'

/**
 * Photo validation schemas
 */

export const photoFilterSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    location: z.string().optional(),
    liked: z.boolean().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict()

export const updatePhotoSchema = z
  .object({
    caption: z.string().min(1).max(500).optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    liked: z.boolean().optional(),
  })
  .strict()

export const photoSchema = z
  .object({
    id: z.string().uuid(),
    url: z.string().url(),
    thumbnail: z.string().url(),
    caption: z.string().min(1).max(500).optional(),
    tags: z.array(z.string()),
    location: z.string().max(200).optional(),
    date: z.string().datetime().optional(),
    faces: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        })
      )
      .optional(),
    aiTags: z.array(z.string()).optional(),
    liked: z.boolean(),
    likeCount: z.number().int().min(0),
    createdAt: z.string().datetime().optional(),
  })
  .strict()

export const photoArraySchema = z.array(photoSchema)

/**
 * Type exports
 */
export type PhotoFilter = z.infer<typeof photoFilterSchema>
export type UpdatePhoto = z.infer<typeof updatePhotoSchema>
export type Photo = z.infer<typeof photoSchema>

/**
 * Validation helpers
 */
export const validatePhotoFilter = (data: unknown) => {
  return photoFilterSchema.safeParse(data)
}

export const validateUpdatePhoto = (data: unknown) => {
  return updatePhotoSchema.safeParse(data)
}

export const validatePhoto = (data: unknown) => {
  return photoSchema.safeParse(data)
}

export const validatePhotoArray = (data: unknown) => {
  return photoArraySchema.safeParse(data)
}
