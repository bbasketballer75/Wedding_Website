import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Upload, X, Image as ImageIcon, Video, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'complete' | 'error'
  preview?: string
  publicUrl?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadFileToSupabase = useCallback(async (fileObj: UploadingFile) => {
    try {
      const file = fileObj.file
      const isVideo = file.type.startsWith('video/')
      const bucket = isVideo ? 'guest-videos' : 'guest-photos'
      
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}`

      // Update progress periodically
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === fileObj.id && f.progress < 90) {
            return { ...f, progress: f.progress + Math.random() * 10 }
          }
          return f
        }))
      }, 300)

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      clearInterval(progressInterval)

      if (error) {
        // Error handled via UI toast
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'error', progress: 0 }
            : f
        ))
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      // Update file as complete
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, status: 'complete', progress: 100, publicUrl }
          : f
      ))

    } catch {
      // Error handled via UI toast
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, status: 'error', progress: 0 }
          : f
      ))
    }
  }, [])

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isValidSize = file.size <= 500 * 1024 * 1024 // 500MB
      
      return (isImage || isVideo) && isValidSize
    })

    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }))

    setFiles(prev => [...prev, ...newUploadingFiles])

    // Start uploading files to Supabase
    newUploadingFiles.forEach((fileObj) => {
      void uploadFileToSupabase(fileObj)
    })
  }, [uploadFileToSupabase])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }, [addFiles])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Form submission started
    
    if (files.length === 0 || !name || !email) {
      // Validation error shown in UI
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Separate photo and video URLs
      const photoUrls = files
        .filter(f => f.status === 'complete' && !f.file.type.startsWith('video/'))
        .map(f => f.publicUrl)
        .filter(Boolean) as string[]
      
      const videoUrls = files
        .filter(f => f.status === 'complete' && f.file.type.startsWith('video/'))
        .map(f => f.publicUrl)
        .filter(Boolean) as string[]

      // Saving to database
      
      // Save to guest_uploads table
      const { error } = await supabase
        .from('guest_uploads')
        .insert([
          {
            guest_name: name,
            guest_email: email,
            message: message || null,
            photo_urls: photoUrls,
            video_urls: videoUrls,
            status: 'pending'
          }
        ])
        .select()

      // Response handled

      if (error) {
        throw error
      }

      setIsSubmitted(true)
      
    } catch {
      // Error handled via UI toast
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const retryUpload = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file) {
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ))
      void uploadFileToSupabase(file)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-cream-50 pt-32 pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-2xl p-12 shadow-lg border border-gold-200/60"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="font-display text-3xl text-charcoal-900 mb-4">
              Thank You!
            </h2>
            <p className="text-charcoal-600 mb-6">
              Your {files.length} photo{files.length !== 1 && 's'} have been uploaded and are pending approval. 
              We'll review them and add them to the gallery soon!
            </p>
            <p className="text-charcoal-500 text-sm mb-8">
              You'll receive an email at {email} when your photos are live.
            </p>
            <div className="flex gap-4 justify-center">
              <Button to="/gallery" variant="secondary">
                View Gallery
              </Button>
              <Button onClick={() => window.location.reload()}>
                Upload More
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const completedFiles = files.filter(f => f.status === 'complete').length
  const hasErrors = files.some(f => f.status === 'error')

  return (
    <div className="min-h-screen bg-cream-50 pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <span className="text-gold-600 text-sm uppercase tracking-[0.3em] font-medium">
            Share Your Memories
          </span>
          <h1 className="font-display text-5xl md:text-6xl text-charcoal-900 mt-4 mb-4">
            Upload Your Photos
          </h1>
          <p className="text-charcoal-600 max-w-xl mx-auto">
            Help us complete the story! Share your photos and videos from our wedding day. 
            All uploads are reviewed before being added to the gallery.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit}>
          {/* Drop Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all",
                isDragging 
                  ? "border-gold-500 bg-gold-50/50" 
                  : "border-gold-200/60 bg-white hover:border-gold-400"
              )}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="w-16 h-16 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-gold-600" />
              </div>
              
              <p className="text-charcoal-700 font-medium mb-2">
                Drop your photos here
              </p>
              <p className="text-charcoal-500 text-sm mb-4">
                or click to browse your files
              </p>
              
              <div className="flex items-center justify-center gap-4 text-xs text-charcoal-400">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Photos: JPG, PNG, HEIC
                </span>
                <span className="flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  Videos: MP4, MOV
                </span>
              </div>
              <p className="text-charcoal-400 text-xs mt-2">
                Up to 50 files, 500MB each
              </p>
            </div>
          </motion.div>

          {/* File List */}
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8"
            >
              <h3 className="text-sm font-medium text-charcoal-700 mb-4">
                {completedFiles} of {files.length} file{files.length !== 1 && 's'} uploaded
                {hasErrors && ' (some failed)'}
              </h3>
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className={cn(
                    "flex items-center gap-4 bg-white p-4 rounded-xl border border-gold-200/60 shadow-sm",
                    file.status === 'error' ? "border-rose-200" : "border-gold-100"
                  )}>
                    {file.preview ? (
                      <img src={file.preview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-charcoal-100 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-charcoal-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal-700 truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-charcoal-400">
                        {(file.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                      
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="h-1 bg-gold-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gold-500 transition-all duration-300"
                              style={{ width: `${Math.min(file.progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {file.status === 'error' && (
                        <p className="text-xs text-rose-500 mt-1">
                          Upload failed - 
                          <button 
                            type="button"
                            onClick={() => retryUpload(file.id)}
                            className="underline ml-1 hover:text-rose-600"
                          >
                            retry
                          </button>
                        </p>
                      )}
                    </div>

                    {file.status === 'complete' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : file.status === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="p-1 text-charcoal-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-8"
            >
              <p className="text-rose-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {submitError}
              </p>
            </motion.div>
          )}

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-8 shadow-lg border border-gold-200/60 mb-8"
          >
            <h3 className="font-display text-xl text-charcoal-900 mb-6">Your Information</h3>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                <p className="text-xs text-charcoal-400 mt-1">
                  We'll notify you when your photos are approved
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="message">Add a Note (Optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about these photos or leave a message..."
                rows={4}
              />
            </div>
          </motion.div>

          {/* Privacy Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-cream-100 rounded-xl p-6 mb-8"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gold-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-charcoal-700 mb-1">
                  Privacy Notice
                </p>
                <p className="text-sm text-charcoal-600">
                  By uploading, you confirm these are your photos from our wedding day. 
                  Only Austin & Jordyn will see these until approved. 
                  Once approved, they'll be visible to other wedding guests.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center"
          >
            <Button 
              type="submit" 
              size="lg" 
              disabled={files.length === 0 || !name || !email || isSubmitting || completedFiles === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : completedFiles === 0 && files.length > 0 ? (
                'Wait for uploads...'
              ) : files.length > 0 ? (
                `Submit ${completedFiles} Photo${completedFiles !== 1 ? 's' : ''}`
              ) : (
                'Select Photos First'
              )}
            </Button>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
