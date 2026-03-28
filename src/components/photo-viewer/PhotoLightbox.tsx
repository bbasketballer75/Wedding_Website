import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { ShareModal } from '@/components/share/ShareModal'
import {
  X, Heart, Share2, Download, ChevronLeft, ChevronRight,
  MessageCircle, Send, ZoomIn, ZoomOut, Tag, User, Loader2, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaceTag {
  id: string
  name: string
  x: number
  y: number
  box?: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

interface Comment {
  id: string
  author: string
  avatar?: string
  content: string
  timestamp: string
}

interface Photo {
  id: string
  url: string
  caption?: string
  tags?: string[]
  location?: string
  date?: string
  time?: string
  photographer?: string
  faces?: FaceTag[]
  liked?: boolean
  likeCount?: number
  likes?: number
  comments?: Comment[]
  commentCount?: number
}

interface PhotoLightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
  onLike?: (photoId: string) => void
  onShare?: (photoId: string) => void
  onDownload?: (photoId: string) => void
  onAddComment?: (photoId: string, payload: { author: string; content: string }) => Promise<boolean> | boolean
  isDownloading?: boolean
  isSubmittingComment?: boolean
  highlightedFaceName?: string | null
}

export function PhotoLightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onLike,
  onShare,
  onDownload,
  onAddComment,
  isDownloading = false,
  isSubmittingComment = false,
  highlightedFaceName = null,
}: PhotoLightboxProps) {
  const [showInfo, setShowInfo] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  )
  const [showFaces, setShowFaces] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [commentAuthor, setCommentAuthor] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem('wedding-gallery-comment-author') || ''
  })
  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info')
  const [selectedFace, setSelectedFace] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [isImageHovered, setIsImageHovered] = useState(false)

  const currentPhoto = photos[currentIndex]
  const hasMultiplePhotos = photos.length > 1
  const visibleFaces = (currentPhoto?.faces || []).filter((face) =>
    highlightedFaceName ? face.name === highlightedFaceName : true
  )
  const shouldRenderFaceOverlay = showFaces && (isImageHovered || Boolean(highlightedFaceName))
  const defaultSelectedFaceId = highlightedFaceName
    ? currentPhoto?.faces?.find((face) => face.name === highlightedFaceName)?.id ?? null
    : null
  const activeSelectedFaceId =
    selectedFace && currentPhoto?.faces?.some((face) => face.id === selectedFace)
      ? selectedFace
      : defaultSelectedFaceId

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1)
      setZoom(1)
      setSelectedFace(null)
    }
  }, [currentIndex, onNavigate])

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1)
      setZoom(1)
      setSelectedFace(null)
    }
  }, [currentIndex, photos.length, onNavigate])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        handlePrevious()
        break
      case 'ArrowRight':
        handleNext()
        break
      case 'l':
        currentPhoto && onLike?.(currentPhoto.id)
        break
    }
  }, [isOpen, onClose, handlePrevious, handleNext, currentPhoto, onLike])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim() && currentPhoto) {
      const didCreate = await onAddComment?.(currentPhoto.id, {
        author: commentAuthor,
        content: newComment,
      })

      if (didCreate !== false) {
        if (typeof window !== 'undefined' && commentAuthor.trim()) {
          window.localStorage.setItem('wedding-gallery-comment-author', commentAuthor.trim())
        }
        setNewComment('')
      }
    }
  }

  if (!currentPhoto) return null

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex bg-black/95"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose()
              }
            }}
          >
            {/* Main Image Area */}
            <div className="flex-1 flex flex-col relative">
              {/* Toolbar */}
              <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent p-2.5 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-black/25 px-3 py-1 text-white/85 text-sm backdrop-blur-sm">
                    {currentIndex + 1} / {photos.length}
                  </span>
                  {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFaces(!showFaces); }}
                      type="button"
                      aria-label={showFaces ? 'Turn off face hints' : 'Turn on face hints'}
                      className={cn(
                        "p-2.5 rounded-full transition-colors",
                        showFaces ? "bg-gold-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                      )}
                    >
                      <Tag className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.5, 3)); }}
                    type="button"
                    aria-label="Zoom in"
                    className="rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.5, 1)); }}
                    type="button"
                    aria-label="Zoom out"
                    className="rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    type="button"
                    aria-label="Close photo viewer"
                    className="rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Arrows */}
              {hasMultiplePhotos && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                    type="button"
                    aria-label="Previous photo"
                    disabled={currentIndex === 0}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:left-4 sm:p-3.5"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    type="button"
                    aria-label="Next photo"
                    disabled={currentIndex === photos.length - 1}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:right-4 sm:p-3.5"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Container with Face Tags */}
              <div className="flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-8">
                <motion.div
                  animate={{ scale: zoom }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                  onMouseEnter={() => setIsImageHovered(true)}
                  onMouseLeave={() => {
                    setIsImageHovered(false)
                    if (!highlightedFaceName) {
                      setSelectedFace(null)
                    }
                  }}
                >
                  <img
                    src={currentPhoto.url}
                    alt={currentPhoto.caption || 'Wedding photo'}
                    className="max-h-[calc(100vh-11rem)] max-w-full rounded-lg object-contain sm:max-h-[80vh]"
                  />
                  
                  {/* Face Tags Overlay */}
                  {shouldRenderFaceOverlay && visibleFaces.map((face) => (
                    <button
                      key={face.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedFace(face.id); }}
                      type="button"
                      aria-label={`Show tag for ${face.name}`}
                    className="absolute w-14 h-14 sm:w-12 sm:h-12 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${face.x}%`, top: `${face.y}%` }}
                    >
                      <div className={cn(
                        "w-full h-full rounded-full border-2 transition-all",
                        activeSelectedFaceId === face.id 
                          ? "border-gold-400 bg-gold-400/20" 
                          : "border-white/70 hover:border-gold-400 hover:bg-gold-400/10"
                      )} />
                      {(activeSelectedFaceId === face.id || Boolean(highlightedFaceName)) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gold-500 text-white text-sm rounded-full whitespace-nowrap"
                        >
                          {face.name}
                        </motion.div>
                      )}
                    </button>
                  ))}
                </motion.div>
              </div>

              {/* Bottom Toolbar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onLike?.(currentPhoto.id); }}
                    type="button"
                    aria-label={currentPhoto.liked ? 'Unlike photo' : 'Like photo'}
                    className={cn(
                      "flex min-h-11 items-center gap-2 px-4 py-2 rounded-full transition-colors",
                      currentPhoto.liked 
                        ? "bg-rose-500 text-white" 
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    )}
                  >
                    <Heart className={cn("w-5 h-5", currentPhoto.liked && "fill-current")} />
                    <span>{currentPhoto.likeCount ?? currentPhoto.likes ?? 0}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onShare?.(currentPhoto.id)
                      setShareModalOpen(true)
                    }}
                    type="button"
                    aria-label="Share photo"
                    className="flex min-h-11 items-center gap-2 px-3 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDownload?.(currentPhoto.id); }}
                    type="button"
                    aria-label="Download photo"
                    disabled={isDownloading}
                    className="flex min-h-11 items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span className="text-sm">Download</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                    type="button"
                    aria-label={showInfo ? 'Hide photo details' : 'Show photo details'}
                    className={cn(
                      "flex min-h-11 items-center gap-2 px-4 py-2 rounded-full transition-colors",
                      showInfo ? "bg-gold-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                    )}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{currentPhoto.commentCount ?? currentPhoto.comments?.length ?? 0}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Info Panel */}
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : 300, y: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 0, opacity: 0 }}
                  animate={{ x: 0, y: 0, opacity: 1 }}
                  exit={{ x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : 300, y: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 0, opacity: 0 }}
                  className="fixed inset-x-0 bottom-0 z-20 flex h-[min(72vh,34rem)] flex-col rounded-t-[1.5rem] border-t border-charcoal-800 bg-charcoal-900 landscape:h-[min(55vh,28rem)] sm:relative sm:inset-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-l sm:border-t-0 sm:landscape:h-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Tabs */}
                  <div className="flex border-b border-charcoal-800">
                    <button
                      onClick={() => setActiveTab('info')}
                      type="button"
                      className={cn(
                        "flex-1 py-3 text-sm font-medium transition-colors",
                        activeTab === 'info' ? "text-gold-400 border-b-2 border-gold-400" : "text-charcoal-400 hover:text-white"
                      )}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveTab('comments')}
                      type="button"
                      className={cn(
                        "flex-1 py-3 text-sm font-medium transition-colors",
                        activeTab === 'comments' ? "text-gold-400 border-b-2 border-gold-400" : "text-charcoal-400 hover:text-white"
                      )}
                    >
                      Comments ({currentPhoto.commentCount ?? currentPhoto.comments?.length ?? 0})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-4 pb-8 sm:pb-4">
                    {activeTab === 'info' ? (
                      <div className="space-y-4">
                        {currentPhoto.caption && (
                          <div>
                            <h3 className="text-white font-medium mb-2">{currentPhoto.caption}</h3>
                            <p className="text-sm leading-6 text-charcoal-400">
                              Keep the focus on the image. Download, comment, or use the people list only when you need the extra context.
                            </p>
                          </div>
                        )}
                        
                        {(currentPhoto.time || currentPhoto.date) && (
                          <div className="flex items-center gap-2 text-charcoal-500 text-sm">
                            <Clock className="w-4 h-4 text-gold-500" />
                            <span>
                              {currentPhoto.time && `${currentPhoto.time} • `}
                              {currentPhoto.date && new Date(currentPhoto.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}

                        {/* People in Photo */}
                        {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                          <div>
                            <h4 className="text-charcoal-400 text-sm mb-2">People in this photo</h4>
                            <div className="flex flex-wrap gap-2">
                              {currentPhoto.faces.map(face => (
                                <div
                                  key={face.id}
                                  className="flex items-center gap-2 px-3 py-1 bg-charcoal-800 rounded-full"
                                >
                                  <User className="w-3 h-3 text-gold-500" />
                                  <span className="text-charcoal-300 text-sm">{face.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!currentPhoto.caption && !(currentPhoto.faces && currentPhoto.faces.length > 0) && (
                          <p className="text-sm leading-6 text-charcoal-400">
                            Use the toolbar for download and comments. This panel stays intentionally light unless the photo has people or a caption attached.
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Comments Tab */
                      <div className="space-y-4">
                        {currentPhoto.comments?.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar fallback={comment.author} size="sm" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-medium text-sm">{comment.author}</span>
                                <span className="text-charcoal-500 text-xs">{comment.timestamp}</span>
                              </div>
                              <p className="text-charcoal-300 text-sm">{comment.content}</p>
                            </div>
                          </div>
                        ))}

                        {/* Add Comment */}
                        <form onSubmit={handleSubmitComment} className="mt-4 space-y-3">
                          <Input
                            value={commentAuthor}
                            onChange={(e) => setCommentAuthor(e.target.value)}
                            placeholder="Your name"
                            maxLength={60}
                            className="bg-charcoal-800 border-charcoal-700 text-white placeholder:text-charcoal-500"
                          />
                          <div className="flex gap-2">
                            <Input
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment..."
                              className="flex-1 bg-charcoal-800 border-charcoal-700 text-white placeholder:text-charcoal-500"
                              maxLength={1000}
                            />
                            <Button type="submit" size="sm" disabled={!newComment.trim() || isSubmittingComment}>
                              {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={currentPhoto?.caption || "Wedding Photo"}
        description="Check out this beautiful moment from Austin & Jordyn's wedding!"
        imageUrl={currentPhoto?.url}
      />
    </>
  )
}

export default PhotoLightbox
