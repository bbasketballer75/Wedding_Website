import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Video, Square, Trash2, Check, SwitchCamera } from 'lucide-react'

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  maxDuration?: number // in seconds
}

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

export function VideoRecorder({ onRecordingComplete, maxDuration = 30 }: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [countdown, setCountdown] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }

      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [videoUrl])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Could not access camera. Please check permissions.')
    }
  }, [facingMode])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    // Countdown
    setCountdown(3)
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    setCountdown(0)

    if (!streamRef.current) {
      await startCamera()
    }

    if (streamRef.current) {
      const mediaRecorder = new MediaRecorder(streamRef.current)
      mediaRecorderRef.current = mediaRecorder
      videoChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        setVideoBlob(blob)
        setVideoUrl(URL.createObjectURL(blob))
        
        // Stop camera
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    }
  }, [maxDuration, startCamera, stopRecording])

  const discardRecording = useCallback(() => {
    setVideoBlob(null)
    setVideoUrl(null)
    setRecordingTime(0)
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    startCamera()
  }, [videoUrl, startCamera])

  const toggleFacingMode = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      setTimeout(() => startCamera(), 100)
    }
  }, [startCamera])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show recorded video
  if (videoBlob && videoUrl) {
    return (
      <div className="bg-cream-50 rounded-xl p-6">
        <video
          src={videoUrl}
          className="w-full aspect-video rounded-lg bg-black mb-4"
          controls
          aria-label="Recorded video preview"
        >
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
        </video>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={discardRecording}
            className="flex-1"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Redo
          </Button>
          <Button
            size="sm"
            onClick={() => onRecordingComplete(videoBlob)}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Use This
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-cream-50 rounded-xl p-6">
      {/* Camera Preview */}
      <div className="relative aspect-video rounded-lg bg-charcoal-900 overflow-hidden mb-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          aria-label="Camera preview"
        >
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
        </video>

        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50"
            >
              <span className="font-display text-8xl text-white">{countdown}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">
              {formatTime(recordingTime)} / {maxDuration}s
            </span>
          </div>
        )}

        {/* Camera Switch */}
        {!isRecording && (
          <button
            type="button"
            onClick={toggleFacingMode}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="w-16 h-16 bg-gold-500 text-white rounded-full flex items-center justify-center hover:bg-gold-600 transition-colors shadow-lg hover:shadow-xl"
            aria-label="Start video recording"
          >
            <Video className="w-7 h-7" />
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg"
            aria-label="Stop video recording"
          >
            <Square className="w-6 h-6" fill="currentColor" />
          </button>
        )}
      </div>

      <p className="text-center text-charcoal-500 text-sm mt-4">
        {isRecording 
          ? 'Recording...'
          : `Tap to record a video message (max ${maxDuration}s)`
        }
      </p>
    </div>
  )
}

export default VideoRecorder
