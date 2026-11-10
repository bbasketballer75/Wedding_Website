import type { GalleryPhoto } from './data'
import type { ViewerPhoto } from '@/features/photo-viewer'

/**
 * Map the gallery feature's view model onto the W5-2 viewer contract.
 * Field names mirror the frozen `Photo` object the lightbox used to receive.
 */
export function mapGalleryPhotoToViewerPhoto(photo: GalleryPhoto): ViewerPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnail: photo.thumbnail,
    caption: photo.caption ?? null,
    album: photo.album ?? null,
    album_sort_order: photo.albumSortOrder ?? null,
    category: photo.category ?? null,
    location: photo.location ?? null,
    date: photo.date ?? null,
    time: photo.time ?? null,
    photographer: photo.photographer ?? null,
    is_professional: photo.source === 'professional',
    download_url: photo.downloadUrl ?? null,
    tags: [...photo.tags],
    likes: photo.likes,
    ...(photo.liked === undefined ? {} : { liked: photo.liked }),
    ...(photo.commentCount === undefined ? {} : { commentCount: photo.commentCount }),
    ...(photo.createdAt === undefined ? {} : { created_at: photo.createdAt }),
    faces: photo.faces.map(face => ({
      id: face.id,
      name: face.name,
      x: face.x,
      y: face.y,
      ...(face.box ? { box: { ...face.box } } : {}),
    })),
  }
}
