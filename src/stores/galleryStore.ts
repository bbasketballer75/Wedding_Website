import type { GalleryImage, PaginationState, SearchFilters } from '@/types'
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'

// Safe sessionStorage wrapper per D-01
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try {
      return sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      sessionStorage.setItem(name, value)
    } catch {
      // Quota exceeded - skip caching, fallback to memory-only
    }
  },
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}

export interface GalleryState {
  // Gallery images
  images: GalleryImage[]
  featuredImages: GalleryImage[]

  // Loading states
  isLoading: boolean
  isUploading: boolean

  // Pagination
  pagination: PaginationState

  // Search and filters
  searchQuery: string
  filters: SearchFilters
  filteredImages: GalleryImage[]

  // Attribution filter for "My Photos" claiming
  attributedEmail: string | null

  // Selection
  selectedImages: string[]

  // Modal
  selectedImageIndex: number | null
  isModalOpen: boolean

  // Actions
  setImages: (images: GalleryImage[]) => void
  addImages: (images: GalleryImage[]) => void
  updateImage: (id: string, updates: Partial<GalleryImage>) => void
  removeImage: (id: string) => void
  applyFilters: () => void

  setLoading: (loading: boolean) => void
  setUploading: (uploading: boolean) => void

  setPagination: (pagination: Partial<PaginationState>) => void
  nextPage: () => void
  resetPagination: () => void

  setSearchQuery: (query: string) => void
  setFilters: (filters: SearchFilters) => void
  clearFilters: () => void

  // Attribution filter for claimed photos
  setAttributedEmail: (email: string | null) => void

  toggleImageSelection: (id: string) => void
  selectAllImages: () => void
  clearSelection: () => void

  openImageModal: (index: number) => void
  closeImageModal: () => void
  nextImage: () => void
  previousImage: () => void
}

// Prefetch adjacent images for smooth lightbox navigation
const prefetchAdjacentImages = (currentIndex: number, images: GalleryImage[]) => {
  const toPrefetch: string[] = []

  if (currentIndex > 0 && images[currentIndex - 1]) {
    toPrefetch.push(images[currentIndex - 1].src)
  }
  if (currentIndex < images.length - 1 && images[currentIndex + 1]) {
    toPrefetch.push(images[currentIndex + 1].src)
  }

  toPrefetch.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)
  })
}

export const useGalleryStore = create<GalleryState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          images: [],
          featuredImages: [],
          isLoading: false,
          isUploading: false,
          pagination: {
            page: 0,
            pageSize: 24,
            hasMore: true,
          },
          searchQuery: '',
          filters: {},
          filteredImages: [],
          attributedEmail: null,
          selectedImages: [],
          selectedImageIndex: null,
          isModalOpen: false,

          // Image management
          setImages: images => {
            const featured = images.filter(img => img.type === 'main' || img.type === 'featured')
            set({ images, featuredImages: featured })
            get().applyFilters()
          },

          addImages: newImages =>
            set(state => {
              const images = [...state.images, ...newImages]
              const featured = images.filter(img => img.type === 'main' || img.type === 'featured')
              return { images, featuredImages: featured }
            }),

          updateImage: (id, updates) =>
            set(state => ({
              images: state.images.map(img => (img.id === id ? { ...img, ...updates } : img)),
            })),

          removeImage: id =>
            set(state => ({
              images: state.images.filter(img => img.id !== id),
              selectedImages: state.selectedImages.filter(selectedId => selectedId !== id),
            })),

          // Loading states
          setLoading: isLoading => set({ isLoading }),
          setUploading: isUploading => set({ isUploading }),

          // Pagination
          setPagination: pagination =>
            set(state => ({
              pagination: { ...state.pagination, ...pagination },
            })),

          nextPage: () => {
            const { pagination } = get()
            if (pagination.hasMore) {
              set(state => ({
                pagination: { ...state.pagination, page: state.pagination.page + 1 },
              }))
            }
          },

          resetPagination: () =>
            set({
              pagination: {
                page: 0,
                pageSize: 24,
                hasMore: true,
              },
            }),

          // Search and filters
          setSearchQuery: query => {
            set({ searchQuery: query })
            get().applyFilters()
          },

          setFilters: filters => {
            set({ filters })
            get().applyFilters()
          },

          clearFilters: () => {
            set({ searchQuery: '', filters: {} })
            get().applyFilters()
          },

          setAttributedEmail: email => {
            set({ attributedEmail: email })
            get().applyFilters()
          },

          applyFilters: () => {
            const { images, searchQuery, filters, attributedEmail } = get()
            let filtered = [...images]

            // Apply search query
            if (searchQuery) {
              const query = searchQuery.toLowerCase()
              filtered = filtered.filter(
                img =>
                  img.alt.toLowerCase().includes(query) || img.caption?.toLowerCase().includes(query)
              )
            }

            // Apply category filter
            if (filters.category) {
              filtered = filtered.filter(img => img.type === filters.category)
            }

            // Apply tags filter
            if (filters.tags && filters.tags.length > 0) {
              filtered = filtered.filter(
                img => filters.tags?.some(tag => img.alt.includes(tag)) ?? false
              )
            }

            // Apply attributed email filter for "My Photos" claiming
            if (attributedEmail) {
              filtered = filtered.filter(img => {
                // For guest uploads, check if the uploader email matches the attributed email
                // This is stored in the img object's metadata
                const uploaderEmail = (img as Record<string, unknown>).uploaderEmail as string | undefined
                return uploaderEmail?.toLowerCase() === attributedEmail.toLowerCase()
              })
            }

            set({ filteredImages: filtered })
          },

          // Selection
          toggleImageSelection: id =>
            set(state => ({
              selectedImages: state.selectedImages.includes(id)
                ? state.selectedImages.filter(selectedId => selectedId !== id)
                : [...state.selectedImages, id],
            })),

          selectAllImages: () =>
            set(state => ({
              selectedImages: state.filteredImages.map(img => img.id),
            })),

          clearSelection: () => set({ selectedImages: [] }),

          // Modal
          openImageModal: index => set({ selectedImageIndex: index, isModalOpen: true }),

          closeImageModal: () => set({ selectedImageIndex: null, isModalOpen: false }),

          nextImage: () => {
            const { selectedImageIndex, filteredImages } = get()
            if (selectedImageIndex !== null && selectedImageIndex < filteredImages.length - 1) {
              const newIndex = selectedImageIndex + 1
              set({ selectedImageIndex: newIndex })
              prefetchAdjacentImages(newIndex, filteredImages)
            }
          },

          previousImage: () => {
            const { selectedImageIndex, filteredImages } = get()
            if (selectedImageIndex !== null && selectedImageIndex > 0) {
              const newIndex = selectedImageIndex - 1
              set({ selectedImageIndex: newIndex })
              prefetchAdjacentImages(newIndex, filteredImages)
            }
          },
        }),
        {
          name: 'gallery-store',
          storage: createJSONStorage(() => safeSessionStorage),
          partialize: state => ({
            images: state.images,
            pagination: state.pagination,
            filters: state.filters,
            selectedImageIndex: state.selectedImageIndex,
            isModalOpen: state.isModalOpen,
          }),
        }
      )
    ),
    { name: 'gallery-store' }
  )
)
