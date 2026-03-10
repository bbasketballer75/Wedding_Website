import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { ShareModal } from '@/components/share/ShareModal'
import { 
  X, Heart, Share2, Download, ChevronLeft, ChevronRight, 
  MessageCircle, Send, ZoomIn, ZoomOut, Tag, User, Loader2, Camera, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaceTag {
  id: string
  name: string
  x: number
  y: number
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
  onAddComment?: (photoId: string, comment: string) => void
  isDownloading?: boolean
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
}: PhotoLightboxProps) {
  const [showInfo, setShowInfo] = useState(true)
  const [showFaces, setShowFaces] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info')
  const [selectedFace, setSelectedFace] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const currentPhoto = photos[currentIndex]
  const hasMultiplePhotos = photos.length > 1

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1)
      setZoom(1)
    }
  }, [currentIndex, onNavigate])

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1)
      setZoom(1)
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

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim() && currentPhoto) {
      onAddComment?.(currentPhoto.id, newComment)
      setNewComment('')
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
            className="fixed inset-0 z-50 bg-black/95 flex"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose()
              }
            }}
          >
            {/* Main Image Area */}
            <div className="flex-1 flex flex-col relative">
              {/* Toolbar */}
              <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm">
                    {currentIndex + 1} / {photos.length}
                  </span>
                  {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFaces(!showFaces); }}
                      type="button"
                      aria-label={showFaces ? 'Hide face tags' : 'Show face tags'}
                      className={cn(
                        "p-2 rounded-full transition-colors",
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
                    className="p-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.5, 1)); }}
                    type="button"
                    aria-label="Zoom out"
                    className="p-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    type="button"
                    aria-label="Close photo viewer"
                    className="p-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
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
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    type="button"
                    aria-label="Next photo"
                    disabled={currentIndex === photos.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Container with Face Tags */}
              <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                <motion.div
                  animate={{ scale: zoom }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  <img
                    src={currentPhoto.url}
                    alt={currentPhoto.caption || 'Wedding photo'}
                    className="max-h-[80vh] max-w-full object-contain rounded-lg"
                  />
                  
                  {/* Face Tags Overlay */}
                  {showFaces && currentPhoto.faces?.map((face) => (
                    <button
                      key={face.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedFace(face.id); }}
                      type="button"
                      aria-label={`Show tag for ${face.name}`}
                      className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${face.x}%`, top: `${face.y}%` }}
                    >
                      <div className={cn(
                        "w-full h-full rounded-full border-2 transition-all",
                        selectedFace === face.id 
                          ? "border-gold-400 bg-gold-400/20" 
                          : "border-white/70 hover:border-gold-400 hover:bg-gold-400/10"
                      )} />
                      {selectedFace === face.id && (
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
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); onLike?.(currentPhoto.id); }}
                    type="button"
                    aria-label={currentPhoto.liked ? 'Unlike photo' : 'Like photo'}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
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
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDownload?.(currentPhoto.id); }}
                    type="button"
                    aria-label="Download photo"
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                    type="button"
                    aria-label={showInfo ? 'Hide photo details' : 'Show photo details'}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                      showInfo ? "bg-gold-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                    )}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{currentPhoto.comments?.length || 0}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Info Panel */}
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 300, opacity: 0 }}
                  className="w-80 bg-charcoal-900 border-l border-charcoal-800 flex flex-col"
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
                      Comments ({currentPhoto.comments?.length || 0})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'info' ? (
                      <div className="space-y-4">
                        {currentPhoto.caption && (
                          <div>
                            <h3 className="text-white font-medium mb-2">{currentPhoto.caption}</h3>
                          </div>
                        )}
                        
                        {/* Time */}
                        {(currentPhoto.time || currentPhoto.date) && (
                          <div className="flex items-center gap-2 text-charcoal-400 text-sm">
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
                        
                        {currentPhoto.location && (
                          <div className="flex items-center gap-2 text-charcoal-400 text-sm">
                            <span className="text-gold-500">📍</span>
                            {currentPhoto.location}
                          </div>
                        )}

                        {/* Photographer Credit */}
                        {currentPhoto.photographer && (
                          <div className="flex items-center gap-2 text-charcoal-400 text-sm bg-charcoal-800/50 p-3 rounded-lg">
                            <Camera className="w-4 h-4 text-gold-500" />
                            <span>Photo by <span className="text-gold-400">{currentPhoto.photographer}</span></span>
                          </div>
                        )}

                        {/* Tags */}
                        {(currentPhoto.tags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(currentPhoto.tags ?? []).map(tag => (
                              <span
                                key={tag}
                                className="px-3 py-1 bg-charcoal-800 text-charcoal-300 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* People in Photo */}
                        {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                          <div>
                            <h4 className="text-charcoal-400 text-sm mb-2">People</h4>
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
                        <form onSubmit={handleSubmitComment} className="mt-4">
                          <div className="flex gap-2">
                            <Input
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment..."
                              className="flex-1 bg-charcoal-800 border-charcoal-700 text-white placeholder:text-charcoal-500"
                            />
                            <Button type="submit" size="sm" disabled={!newComment.trim()}>
                              <Send className="w-4 h-4" />
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
