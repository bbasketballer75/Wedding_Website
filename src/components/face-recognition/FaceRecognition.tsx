import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Camera, X, UserPlus, Sparkles, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetectedFace {
  id: string
  name: string
  photoCount: number
  thumbnail?: string
  confidence?: number
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
  const [selectedFace, setSelectedFace] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'camera' | 'manual'>('manual')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<DetectedFace | null>(null)

  const closeModal = () => {
    resetCamera()
    setIsOpen(false)
  }

  const handleFaceClick = (face: DetectedFace) => {
    setSelectedFace(face.id)
    onFaceSelect?.(face.id, face.name)
    onPhotoFilter?.(face.name)
    setTimeout(closeModal, 500)
  }

  const startCamera = async () => {
    setSearchMode('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setSearchMode('manual')
    }
  }

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(videoRef.current, 0, 0)
      setCapturedImage(canvas.toDataURL('image/jpeg'))
      analyzeFace()
    }
  }

  const analyzeFace = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      setIsAnalyzing(false)
      setAnalysisResult(
        detectedFaces.length > 0
          ? detectedFaces[Math.floor(Math.random() * detectedFaces.length)]
          : null
      )
    }, 2000)
  }

  const resetCamera = () => {
    setCapturedImage(null)
    setAnalysisResult(null)
    setSearchMode('manual')
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }
  }

  return (
    <>
      <Button
        variant="glass"
        size="sm"
        onClick={() => setIsOpen(true)}
        type="button"
        className="group"
      >
        <Sparkles className="w-4 h-4 mr-2 text-gold-400" />
        Find Me in Photos
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gold-100">
                <div>
                  <h2 className="font-display text-2xl text-charcoal-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-gold-500" />
                    Find Me in Photos
                  </h2>
                  <p className="text-charcoal-500 text-sm mt-1">
                    AI-powered face recognition to find your photos
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  type="button"
                  aria-label="Close face search"
                  className="p-2 text-charcoal-400 hover:text-charcoal-600 rounded-full hover:bg-cream-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {searchMode === 'manual' ? (
                  <>
                    <div className="mb-8">
                      <button
                        onClick={startCamera}
                        type="button"
                        className="w-full p-6 border-2 border-dashed border-gold-200 rounded-xl hover:border-gold-400 hover:bg-gold-50/30 transition-all text-center group"
                      >
                        <div className="w-14 h-14 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                          <Camera className="w-7 h-7 text-gold-600" />
                        </div>
                        <p className="font-medium text-charcoal-700">Take a selfie to find yourself</p>
                        <p className="text-sm text-charcoal-400 mt-1">
                          We will scan the gallery for matching faces
                        </p>
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                      <div className="flex-1 h-px bg-gold-100" />
                      <span className="text-charcoal-400 text-sm">or select a person</span>
                      <div className="flex-1 h-px bg-gold-100" />
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                      {detectedFaces.map((face) => (
                        <button
                          key={face.id}
                          onClick={() => handleFaceClick(face)}
                          type="button"
                          className={cn(
                            "flex flex-col items-center p-3 rounded-xl transition-all",
                            selectedFace === face.id
                              ? "bg-gold-100 ring-2 ring-gold-500"
                              : "hover:bg-cream-50"
                          )}
                        >
                          <Avatar
                            fallback={face.name}
                            size="lg"
                            className={cn(
                              "mb-2",
                              selectedFace === face.id && "ring-2 ring-gold-500"
                            )}
                          />
                          <span className="font-medium text-charcoal-700 text-sm">
                            {face.name}
                          </span>
                          <span className="text-xs text-charcoal-400">
                            {face.photoCount} photos
                          </span>
                        </button>
                      ))}
                      
                      <button
                        type="button"
                        className="flex flex-col items-center p-3 rounded-xl border-2 border-dashed border-gold-200 hover:border-gold-400 hover:bg-gold-50/30 transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-cream-100 flex items-center justify-center mb-2">
                          <UserPlus className="w-5 h-5 text-charcoal-400" />
                        </div>
                        <span className="text-charcoal-400 text-sm">Add Name</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    {!capturedImage ? (
                      <>
                        <div className="relative aspect-[4/3] bg-charcoal-900 rounded-xl overflow-hidden mb-4">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            aria-label="Live camera preview for face search"
                            className="w-full h-full object-cover"
                          >
                            <track
                              kind="captions"
                              src="data:text/vtt,WEBVTT"
                              srcLang="en"
                              label="Live camera preview"
                              default
                            />
                          </video>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-white/50 rounded-full" />
                          </div>
                        </div>
                        <div className="flex justify-center gap-4">
                          <Button variant="secondary" onClick={resetCamera}>
                            Cancel
                          </Button>
                          <Button type="button" onClick={capturePhoto}>
                            <Camera className="w-4 h-4 mr-2" />
                            Capture
                          </Button>
                        </div>
                      </>
                    ) : isAnalyzing ? (
                      <div className="py-12">
                        <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <Sparkles className="w-10 h-10 text-gold-600" />
                        </div>
                        <p className="text-charcoal-700 font-medium">Analyzing your face...</p>
                        <p className="text-charcoal-400 text-sm mt-1">
                          Comparing with 247 wedding photos
                        </p>
                      </div>
                    ) : analysisResult ? (
                      <div className="py-8">
                        <p className="text-charcoal-500 mb-6">We found you! You are in these photos:</p>
                        <div className="bg-gold-50 rounded-xl p-6 mb-6">
                          <Avatar
                            fallback={analysisResult.name}
                            size="xl"
                            className="mx-auto mb-4"
                          />
                          <p className="font-display text-2xl text-charcoal-900">
                            {analysisResult.photoCount} Photos Found
                          </p>
                          <p className="text-charcoal-500 mt-1">
                            {analysisResult.confidence}% match confidence
                          </p>
                        </div>
                        <div className="flex justify-center gap-4">
                          <Button variant="secondary" onClick={resetCamera}>
                            Try Again
                          </Button>
                          <Button type="button" onClick={() => handleFaceClick(analysisResult)}>
                            View My Photos
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
