import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  maxDuration?: number // in seconds
}

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

export function VoiceRecorder({ onRecordingComplete, maxDuration = 60 }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
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
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }, [maxDuration, stopRecording])

  const discardRecording = useCallback(() => {
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsPlaying(false)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const togglePlayback = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Store random heights for waveform animation - generated once on mount
  const [randomHeights] = useState<number[]>(() =>
    Array.from({ length: 20 }, (_, i) => 10 + ((i * 7) % 30) + 10)
  )

  // Waveform visualization (simulated)
  const waveformBars = Array.from({ length: 20 }, (_, i) => (
    <motion.div
      key={i}
      className="w-1 bg-gold-500 rounded-full"
      animate={{
        height: isRecording
          ? [10, randomHeights[i], 10]
          : 4,
      }}
      transition={{
        duration: 0.3,
        repeat: Infinity,
        delay: i * 0.05,
      }}
    />
  ))

  if (audioBlob && audioUrl) {
    return (
      <div className="bg-cream-50 rounded-xl p-6">
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
          aria-label="Recorded voice message"
        >
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
        </audio>
        
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={togglePlayback}
            className="w-12 h-12 bg-gold-500 text-white rounded-full flex items-center justify-center hover:bg-gold-600 transition-colors"
            aria-label={isPlaying ? 'Pause voice message playback' : 'Play voice message'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          
          <div className="flex-1">
            <p className="text-charcoal-700 font-medium">Voice Message</p>
            <p className="text-charcoal-400 text-sm">{formatTime(recordingTime)}</p>
          </div>
        </div>

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
            onClick={() => onRecordingComplete(audioBlob)}
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
      {/* Waveform */}
      <div className="flex items-center justify-center gap-1 h-16 mb-4">
        {isRecording ? (
          waveformBars
        ) : (
          <div className="flex items-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-1 h-1 bg-gold-200 rounded-full" />
            ))}
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="text-center mb-4">
        <span className={cn(
          "font-display text-3xl",
          isRecording ? "text-gold-600" : "text-charcoal-400"
        )}>
          {formatTime(recordingTime)}
        </span>
        <span className="text-charcoal-400 text-sm ml-2">/ {maxDuration}s max</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="w-16 h-16 bg-gold-500 text-white rounded-full flex items-center justify-center hover:bg-gold-600 transition-colors shadow-lg hover:shadow-xl"
            aria-label="Start voice recording"
          >
            <Mic className="w-7 h-7" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg"
              aria-label="Stop voice recording"
            >
              <Square className="w-6 h-6" fill="currentColor" />
            </button>
          </>
        )}
      </div>

      <p className="text-center text-charcoal-500 text-sm mt-4">
        {isRecording 
          ? 'Recording...'
          : 'Tap to record a voice message'
        }
      </p>
    </div>
  )
}

export default VoiceRecorder
