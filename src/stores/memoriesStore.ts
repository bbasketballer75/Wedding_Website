import { supabase } from '@/lib/supabase'
import type { Memory, PaginationState } from '@/types'
import { compressImage } from '@/utils/imageCompressor'
import { rateLimiter, formatTimeRemaining } from '@/utils/rateLimiter'
import { z } from 'zod' // Import zod
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Define Zod schema for memory form validation
const MemoryFormSchema = z
  .object({
    name: z.string().min(1, 'Please enter your name'),
    message: z.string().optional(),
    photo: z.instanceof(File).optional(),
    altText: z.string().optional(),
    tags: z.array(z.string()).optional(), // Added tags field
  })
  .superRefine((data, ctx) => {
    // Custom validation: if photo is present, altText should be required
    if (data.photo && (!data.altText || data.altText.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide alt text for the photo.',
        path: ['altText'],
      })
    }
    // Custom validation: Either message or photo must be present
    if (!data.message && !data.photo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter a message or add a photo',
        path: ['message'], // Or an empty path to indicate general form error
      })
    }
  })

/**
 * Interface for the Memories Store state and actions.
 */
export interface MemoriesState {
  /** List of loaded memories */
  memories: Memory[]

  /** Whether memories are currently loading */
  isLoading: boolean
  /** Whether a memory submission is in progress */
  isSubmitting: boolean
  /** Error message if any */
  error?: string

  /** Pagination state */
  pagination: PaginationState

  /** Form state for adding a new memory */
  form: {
    name: string
    message: string
    photo?: File
    altText?: string // Added altText field
    tags: string[] // Added tags field
  }

  /** Whether the gallery is auto-scrolling */
  isAutoScrolling: boolean
  /** Whether the gallery is currently hovered */
  isHovered: boolean

  /**
   * Sets the list of memories.
   * @param memories - Array of memories to set.
   */
  setMemories: (memories: Memory[]) => void
  /**
   * Adds a new memory to the store.
   * @param memory - The memory object to add.
   */
  addMemory: (memory: Memory) => void
  /**
   * Updates an existing memory.
   * @param id - The ID of the memory to update.
   * @param updates - Partial memory object with updates.
   */
  updateMemory: (id: string, updates: Partial<Memory>) => void
  /**
   * Removes a memory from the store.
   * @param id - The ID of the memory to remove.
   */
  removeMemory: (id: string) => void

  /**
   * Sets the loading state.
   * @param loading - Boolean indicating loading state.
   */
  setLoading: (loading: boolean) => void
  /**
   * Sets the submitting state.
   * @param submitting - Boolean indicating submitting state.
   */
  setSubmitting: (submitting: boolean) => void

  /**
   * Updates pagination state.
   * @param pagination - Partial pagination state to update.
   */
  setPagination: (pagination: Partial<PaginationState>) => void
  /**
   * Advances to the next page of memories.
   */
  nextPage: () => void
  /**
   * Resets pagination to the first page.
   */
  resetPagination: () => void

  /**
   * Updates a field in the form.
   * @param field - The field name to update.
   * @param value - The new value for the field.
   */
  setFormField: (
    field: keyof MemoriesState['form'],
    value: string | File | string[] | undefined
  ) => void
  /**
   * Resets the form to its initial state.
   */
  resetForm: () => void

  /**
   * Sets the auto-scrolling state.
   * @param scrolling - Boolean indicating auto-scrolling state.
   */
  setAutoScrolling: (scrolling: boolean) => void
  /**
   * Sets the hovered state.
   * @param hovered - Boolean indicating hovered state.
   */
  setHovered: (hovered: boolean) => void

  /**
   * Fetches memories from Supabase.
   * @param page - Optional specific page to fetch.
   * @param isRefresh - Whether to refresh the list (replace instead of append).
   * @param filter - Optional filter object for memories.
   * @returns A promise that resolves when fetching is complete.
   */
  fetchMemories: (
    page?: number,
    isRefresh?: boolean,
    filter?: { tags?: string[] }
  ) => Promise<void>
  /**
   * Submits the current form data to create a new memory.
   * Handles validation, image compression, upload, and database insertion.
   * @returns A promise resolving to an object indicating success or failure.
   */
  submitMemory: () => Promise<{ success: boolean; error?: string }>
}

export const useMemoriesStore = create<MemoriesState>()(
  devtools(
    (set, get) => ({
      // ... existing state ...
      memories: [],
      isLoading: true,
      isSubmitting: false,
      pagination: {
        page: 0,
        pageSize: 24,
        hasMore: true,
      },
      form: {
        name: '',
        message: '',
        photo: undefined,
        altText: '', // Initialize altText
        tags: [], // Initialize tags
      },
      isAutoScrolling: true,
      isHovered: false,

      // Actions implementation
      setMemories: (memories: Memory[]) => set({ memories }),

      addMemory: (memory: Memory) =>
        set(state => ({
          memories: [memory, ...state.memories],
        })),

      updateMemory: (id: string, updates: Partial<Memory>) =>
        set(state => ({
          memories: state.memories.map(m => (m.id === id ? { ...m, ...updates } : m)),
        })),

      removeMemory: (id: string) =>
        set(state => ({
          memories: state.memories.filter(m => m.id !== id),
        })),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setSubmitting: (submitting: boolean) => set({ isSubmitting: submitting }),

      setPagination: (pagination: Partial<PaginationState>) =>
        set(state => ({
          pagination: { ...state.pagination, ...pagination },
        })),

      nextPage: () =>
        set(state => ({
          pagination: { ...state.pagination, page: state.pagination.page + 1 },
        })),

      resetPagination: () =>
        set({
          pagination: { page: 0, pageSize: 24, hasMore: true },
        }),

      setFormField: (
        field: keyof MemoriesState['form'],
        value: string | File | string[] | undefined
      ) =>
        set(state => ({
          form: { ...state.form, [field]: value },
        })),

      resetForm: () =>
        set({
          form: { name: '', message: '', photo: undefined, altText: '', tags: [] }, // Reset altText and tags
        }),

      setAutoScrolling: (scrolling: boolean) => set({ isAutoScrolling: scrolling }),

      setHovered: (hovered: boolean) => set({ isHovered: hovered }),

      // Fetch memories from Supabase
      fetchMemories: async (pageIndex, isRefresh = false, filter) => {
        const { pagination } = get()
        const targetPage = pageIndex !== undefined ? pageIndex : pagination.page
        const pageSize = pagination.pageSize

        try {
          if (isRefresh) set({ isLoading: true })

          const from = targetPage * pageSize
          const to = from + pageSize - 1

          let query = supabase
            .from('all_memories')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

          if (filter?.tags && filter.tags.length > 0) {
            query = query.contains('tags', filter.tags) // Apply tag filtering
          }

          const { data, error } = await query

          if (error) throw error

          const formattedData: Memory[] = (data || []).map(item => ({
            id: item.id,
            name: item.name,
            message: item.message || undefined,
            photo_url: item.photo_url || undefined,
            altText: item.alt_text || undefined,
            type: item.type as 'photo' | 'message' | 'both',
            created_at: item.created_at,
            source: item.source || 'user',
            tags: item.tags || [], // Extract tags
          }))

          if (isRefresh) {
            set({ memories: formattedData, isLoading: false })
          } else {
            set(state => ({
              memories: [...state.memories, ...formattedData],
              isLoading: false,
            }))
          }

          if (formattedData.length < pageSize) {
            get().setPagination({ hasMore: false })
          } else {
            get().setPagination({ hasMore: true })
          }
        } catch (error) {
          // Handle both Error instances and plain objects from Supabase
          let message: string
          if (error instanceof Error) {
            message = error.message
          } else if (typeof error === 'object' && error !== null && 'message' in error) {
            message = String((error as { message: unknown }).message)
          } else {
            message = 'Failed to fetch memories'
          }
          console.error('Error fetching memories:', message)
          set({ 
            error: message, 
            isLoading: false,
            // Keep existing memories if any, otherwise empty array
            memories: get().memories.length > 0 ? get().memories : []
          })
          get().setPagination({ hasMore: false })
        }
      },

      // Submit action
      submitMemory: async () => {
        const { form } = get()

        // Check rate limit before validation
        const rateLimitCheck = rateLimiter.check('memory-submit', {
          maxRequests: 3,
          windowMs: 60000, // 1 minute
        })

        if (!rateLimitCheck.canProceed) {
          const timeRemaining = formatTimeRemaining(rateLimitCheck.timeRemainingMs)
          return {
            success: false,
            error: `Please wait ${timeRemaining} before submitting another memory`,
          }
        }

        // Zod validation
        const validationResult = MemoryFormSchema.safeParse(form)
        if (!validationResult.success) {
          const issues = validationResult.error.issues
          const firstError = issues?.[0]
          return { success: false, error: firstError?.message || 'Validation failed' }
        }
        const validatedForm = validationResult.data // Use validated data

        set({ isSubmitting: true })

        try {
          let photoUrl = undefined
          let photoToUpload = validatedForm.photo

          // Upload photo if present
          if (validatedForm.photo) {
            // Compress image before upload
            try {
              photoToUpload = await compressImage(validatedForm.photo)
            } catch (compressionError) {
              console.warn('Image compression failed, uploading original:', compressionError)
              // Continue with original photo if compression fails
            }

            if (!photoToUpload) throw new Error('Photo required') // Should not happen given the if check
            const fileExt = photoToUpload.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `guest-uploads/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('wedding-photos')
              .upload(filePath, photoToUpload) // Use the potentially compressed photo

            if (uploadError) {
              console.error('Error uploading photo:', uploadError)
              throw new Error('Failed to upload photo. Please try again.')
            }

            const {
              data: { publicUrl },
            } = supabase.storage.from('wedding-photos').getPublicUrl(filePath)

            photoUrl = publicUrl
          }

          // Prepare memory object for DB
          const memoryType =
            validatedForm.photo && validatedForm.message
              ? 'both'
              : validatedForm.photo
                ? 'photo'
                : 'message'

          const newMemoryPayload = {
            name: validatedForm.name.trim(),
            message: validatedForm.message?.trim() || null, // Use validated message
            photo_url: photoUrl,
            alt_text: validatedForm.altText?.trim() || null,
            type: memoryType,
            tags: validatedForm.tags || [], // Include tags
            // created_at will be set by default in DB
          }

          const { data, error: insertError } = await supabase
            .from('shared_memories')
            .insert(newMemoryPayload)
            .select()
            .single()

          if (insertError) {
            console.error('Error inserting memory:', insertError)
            throw new Error('Failed to save memory. Please try again.')
          }

          if (data) {
            const memory: Memory = {
              id: data.id,
              name: data.name,
              message: data.message || undefined,
              photo_url: data.photo_url || undefined,
              altText: data.alt_text || undefined,
              type: data.type as 'photo' | 'message' | 'both',
              created_at: data.created_at,
              source: 'user',
              tags: data.tags || [], // Extract tags
            }

            get().addMemory(memory)
            get().resetForm()
            return { success: true }
          }
          return { success: false, error: 'No data returned from save' }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to submit memory'
          return { success: false, error: message }
        } finally {
          set({ isSubmitting: false })
        }
      },
    }),
    { name: 'memories-store' }
  )
)
