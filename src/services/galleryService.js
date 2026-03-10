import { supabase } from '@/lib/supabase'
import logger from '@/utils/logger'

class GalleryService {
  // Get all gallery images with optional filters
  async getImages(options = {}) {
    const {
      category = null,
      tags = [],
      featured = null,
      limit = 50,
      offset = 0,
      orderBy = 'sort_order',
    } = options

    try {
      let query = supabase
        .from('wedding_gallery')
        .select(
          `
          *,
          gallery_categories (
            name,
            description
          )
        `
        )
        .eq('is_active', true)
        .order(orderBy, { ascending: true })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (category) {
        query = query.eq('category', category)
      }

      if (tags.length > 0) {
        query = query.contains('tags', tags)
      }

      if (featured !== null) {
        query = query.eq('is_featured', featured)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Error fetching gallery images:', error)
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Get image by ID
  async getImageById(id) {
    try {
      const { data, error } = await supabase
        .from('wedding_gallery')
        .select(
          `
          *,
          gallery_categories (
            name,
            description
          )
        `
        )
        .eq('id', id)
        .single()

      if (error) {
        logger.error('Error fetching gallery image:', error)
        throw error
      }

      return data
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Get all categories
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('gallery_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) {
        logger.error('Error fetching gallery categories:', error)
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Upload image to storage
  async uploadImage(file, category = 'wedding') {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${category}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('wedding-gallery')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        logger.error('Error uploading image:', error)
        throw error
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('wedding-gallery').getPublicUrl(fileName)

      return {
        path: data.path,
        publicUrl,
      }
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Create image record
  async createImage(imageData) {
    try {
      const { data, error } = await supabase
        .from('wedding_gallery')
        .insert([
          {
            ...imageData,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) {
        logger.error('Error creating gallery image:', error)
        throw error
      }

      return data
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Update image
  async updateImage(id, updates) {
    try {
      const { data, error } = await supabase
        .from('wedding_gallery')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Error updating gallery image:', error)
        throw error
      }

      return data
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Delete image
  async deleteImage(id) {
    try {
      // First get the image to get the file path
      const image = await this.getImageById(id)

      // Delete from storage
      if (image.image_url) {
        const filePath = image.image_url.split('/').pop()
        await supabase.storage.from('wedding-gallery').remove([`wedding/${filePath}`])
      }

      // Delete from database
      const { error } = await supabase.from('wedding_gallery').delete().eq('id', id)

      if (error) {
        logger.error('Error deleting gallery image:', error)
        throw error
      }

      return true
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }

  // Get featured images
  async getFeaturedImages(limit = 10) {
    return this.getImages({
      featured: true,
      limit,
      orderBy: 'created_at',
    })
  }

  // Search images
  async searchImages(query, options = {}) {
    try {
      const { data, error } = await supabase
        .from('wedding_gallery')
        .select(
          `
          *,
          gallery_categories (
            name,
            description
          )
        `
        )
        .textSearch('title', query)
        .or(`description.ilike.%${query}%`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(options.limit || 20)

      if (error) {
        logger.error('Error searching gallery images:', error)
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('Gallery service error:', error)
      throw error
    }
  }
}

export default new GalleryService()
