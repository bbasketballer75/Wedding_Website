import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Users, Search, X, ArrowRight, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetectedFace {
  id: string
  name: string
  photoCount: number
  thumbnail?: string
  latestMoment?: string
  collections?: string[]
  professionalCount?: number
  guestCount?: number
}

interface FaceRecognitionProps {
  onFaceSelect?: (faceId: string, faceName: string) => void
  onPhotoFilter?: (faceName: string) => void
  detectedFaces?: DetectedFace[]
}

export function FaceRecognition({
  onFaceSelect,
  onPhotoFilter,
  detectedFaces = [],
}: FaceRecognitionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)

  const filteredFaces = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return detectedFaces

    return detectedFaces.filter((face) => {
      return (
        face.name.toLowerCase().includes(normalized) ||
        face.latestMoment?.toLowerCase().includes(normalized)
      )
    })
  }, [detectedFaces, query])

  const handleSelect = (face: DetectedFace) => {
    setSelectedFaceId(face.id)
    onFaceSelect?.(face.id, face.name)
    onPhotoFilter?.(face.name)
    window.setTimeout(() => {
      setIsOpen(false)
      setSelectedFaceId(null)
      setQuery('')
    }, 180)
  }

  const close = () => {
    setIsOpen(false)
    setSelectedFaceId(null)
    setQuery('')
  }

  return (
    <>
      <Button
        variant="glass"
        size="sm"
        type="button"
        onClick={() => setIsOpen(true)}
        className="group"
      >
        <Users className="mr-2 h-4 w-4 text-gold-500 transition-transform duration-300 group-hover:scale-105" />
        Browse People
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(248,241,231,0.98))] shadow-[0_38px_100px_-45px_rgba(46,33,13,0.58)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-gold-100/80 px-6 py-5 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] text-gold-700">
                      Tagged people
                    </p>
                    <h2 className="mt-2 font-display text-3xl text-charcoal-900">
                      Browse the faces we have already confirmed
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal-500">
                      This view filters the gallery by real face tags from the archive. It is review-backed metadata,
                      not a live selfie matcher.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close people browser"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-charcoal-500 transition-colors hover:text-charcoal-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search a name or moment"
                      className="h-12 rounded-full border-gold-200/80 bg-white/88 pl-11 pr-4"
                    />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm text-charcoal-500">
                    <Tags className="h-4 w-4 text-gold-500" />
                    {detectedFaces.length} confirmed people
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-6 py-6 sm:px-8">
                {filteredFaces.length === 0 ? (
                  <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-gold-200/80 bg-white/65 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                      <Search className="h-7 w-7" />
                    </div>
                    <p className="mt-5 font-display text-2xl text-charcoal-900">
                      No tagged person matches that search
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-charcoal-500">
                      Try a broader name, or clear the search to browse everyone we have confirmed so far.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredFaces.map((face) => (
                      <button
                        key={face.id}
                        type="button"
                        onClick={() => handleSelect(face)}
                        className={cn(
                          'group rounded-[1.7rem] border border-white/80 bg-white/86 p-4 text-left shadow-[0_24px_60px_-42px_rgba(46,33,13,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-42px_rgba(46,33,13,0.38)]',
                          selectedFaceId === face.id && 'border-gold-300/90 bg-gold-50/90',
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar
                            src={face.thumbnail}
                            alt={face.name}
                            fallback={face.name}
                            size="xl"
                            className="shrink-0 ring-2 ring-white"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-2xl text-charcoal-900">
                              {face.name}
                            </p>
                            <p className="mt-1 text-sm text-charcoal-500">
                              {face.photoCount} tagged {face.photoCount === 1 ? 'photo' : 'photos'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {typeof face.professionalCount === 'number' && face.professionalCount > 0 && (
                                <span className="rounded-full border border-gold-200 bg-gold-50/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-700">
                                  {face.professionalCount} professional
                                </span>
                              )}
                              {typeof face.guestCount === 'number' && face.guestCount > 0 && (
                                <span className="rounded-full border border-gold-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-charcoal-500">
                                  {face.guestCount} guest
                                </span>
                              )}
                              {(face.collections || []).slice(0, 2).map((collection) => (
                                <span
                                  key={`${face.id}-${collection}`}
                                  className="rounded-full border border-gold-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-charcoal-500"
                                >
                                  {collection}
                                </span>
                              ))}
                            </div>
                            {face.latestMoment && (
                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-charcoal-500">
                                {face.latestMoment}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 inline-flex items-center gap-2 text-sm text-gold-700 transition-transform duration-300 group-hover:translate-x-0.5">
                          Filter gallery
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default FaceRecognition
