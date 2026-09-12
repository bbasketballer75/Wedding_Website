/**
 * useGalleryEngagement — extracted from src/pages/Gallery.tsx.
 *
 * Owns the engagement state: submittingCommentPhotoId (currently-being-submitted
 * flag), and exposes the side-effect handlers that mutate the photos array via
 * the parent's setPhotos: toggleLike (optimistic like) and submitComment
 * (optimistic comment with rollback on failure).
 *
 * Returns:
 *   submittingCommentPhotoId:  id of the photo whose comment is in flight (or null)
 *   toggleLike(photoId):       optimistic like/unlike with supabase call
 *   submitComment(photoId, payload): optimistic comment, rollback on error, returns boolean
 *
 * NOTE: the parent passes in `setPhotos` so this hook stays decoupled from
 * the data state. The hook is purely about the engagement side-effects.
 */
import { useCallback, useState } from 'react'
import { addPhotoComment, togglePhotoLike } from '@/lib/supabase'
import {
  PHOTO_COMMENT_AUTHOR_KEY,
  getPhotoEngagementSessionId,
} from '@/components/gallery/constants'
import { formatPhotoCommentTimestamp } from '@/components/gallery/data'
import { useToast } from '@/context/ToastContext'
import type { GalleryPhoto } from '@/components/gallery/constants'
import type { PhotoComment } from '@/lib/supabase'

export interface UseGalleryEngagementResult {
  submittingCommentPhotoId: string | null
  toggleLike: (photoId: string) => void
  submitComment: (photoId: string, payload: { author: string; content: string }) => Promise<boolean>
}

export interface UseGalleryEngagementParams {
  setPhotos: React.Dispatch<React.SetStateAction<GalleryPhoto[]>>
}

export function useGalleryEngagement({
  setPhotos,
}: UseGalleryEngagementParams): UseGalleryEngagementResult {
  const { addToast } = useToast()
  const [engagementSessionId] = useState(() => getPhotoEngagementSessionId())
  const [submittingCommentPhotoId, setSubmittingCommentPhotoId] = useState<string | null>(null)

  const toggleLike = useCallback(
    (photoId: string) => {
      void (async () => {
        const { data } = await togglePhotoLike(photoId, engagementSessionId)

        if (!data) {
          return
        }

        setPhotos(prev =>
          prev.map(photo =>
            photo.id === photoId
              ? {
                  ...photo,
                  liked: data.liked,
                  likes: data.likes_count,
                  likeCount: data.likes_count,
                }
              : photo
          )
        )
      })()
    },
    [engagementSessionId, setPhotos]
  )

  const submitComment = useCallback(
    async (photoId: string, payload: { author: string; content: string }): Promise<boolean> => {
      const normalizedContent = payload.content.trim()
      const normalizedAuthor = payload.author.trim() || 'Guest'

      if (!normalizedContent) {
        return false
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PHOTO_COMMENT_AUTHOR_KEY, normalizedAuthor)
      }

      const optimisticComment: PhotoComment = {
        id: `pending-${Date.now()}`,
        author: normalizedAuthor,
        content: normalizedContent,
        timestamp: 'Sending...',
      }

      setSubmittingCommentPhotoId(photoId)
      setPhotos(prev =>
        prev.map(photo =>
          photo.id === photoId
            ? {
                ...photo,
                comments: [...(photo.comments || []), optimisticComment],
                commentCount: (photo.commentCount ?? photo.comments?.length ?? 0) + 1,
              }
            : photo
        )
      )

      const { data, error } = await addPhotoComment(
        photoId,
        normalizedContent,
        normalizedAuthor,
        engagementSessionId
      )

      if (error || !data) {
        setPhotos(prev =>
          prev.map(photo =>
            photo.id === photoId
              ? {
                  ...photo,
                  comments: (photo.comments || []).filter(
                    (comment: PhotoComment) => comment.id !== optimisticComment.id
                  ),
                  commentCount: Math.max(
                    (photo.commentCount ?? photo.comments?.length ?? 1) - 1,
                    0
                  ),
                }
              : photo
          )
        )
        setSubmittingCommentPhotoId(current => (current === photoId ? null : current))
        addToast("That didn't go through — try again in a moment.", 'error')
        return false
      }

      const newComment: PhotoComment = {
        id: data.id,
        author: data.author,
        content: data.content,
        timestamp: formatPhotoCommentTimestamp(data.created_at),
      }

      setPhotos(prev =>
        prev.map(photo =>
          photo.id === photoId
            ? {
                ...photo,
                comments: (photo.comments || []).map((comment: PhotoComment) =>
                  comment.id === optimisticComment.id ? newComment : comment
                ),
              }
            : photo
        )
      )
      setSubmittingCommentPhotoId(current => (current === photoId ? null : current))
      return true
    },
    [engagementSessionId, setPhotos, addToast]
  )

  return {
    submittingCommentPhotoId,
    toggleLike,
    submitComment,
  }
}
