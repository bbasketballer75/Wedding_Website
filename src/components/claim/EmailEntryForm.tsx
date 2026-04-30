import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useClaimStore } from '@/stores/claimStore'
import { findClaimableUploadsByEmail } from '@/lib/claimUtils'

interface EmailEntryFormProps {
  onEmailSubmitted: () => void
}

/**
 * Email entry form for photo claiming
 * Implements email enumeration protection (T-18-01)
 * Shows same message regardless of whether email has uploads
 */
export function EmailEntryForm({ onEmailSubmitted }: EmailEntryFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showEnumerationProtection, setShowEnumerationProtection] = useState(false)

  const { setEmail: setStoreEmail, setClaimablePhotos, setVerificationMethod, setStep } =
    useClaimStore()

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError('Please enter your email address')
      return
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      // Check if this email has claimable uploads
      const claimablePhotos = await findClaimableUploadsByEmail(trimmedEmail)

      // Store email in claim store
      setStoreEmail(trimmedEmail)
      setClaimablePhotos(claimablePhotos)

      if (claimablePhotos.length === 0) {
        // Email enumeration protection: show same message whether or not email has uploads
        setShowEnumerationProtection(true)
        setTimeout(() => {
          setShowEnumerationProtection(false)
          // Redirect to verification step (magic link flow is simpler)
          setVerificationMethod('magic_link')
          setStep('verification_sent')
          onEmailSubmitted()
        }, 2000)
      } else {
        // Has uploads - show verification method selection
        setStep('verification_sent')
        onEmailSubmitted()
      }
    } catch (err) {
      console.error('Error checking uploads:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
          <Mail className="h-6 w-6 text-gold-600" />
        </div>
        <h3 className="font-display text-2xl text-charcoal-900">
          Claim Your Photos
        </h3>
        <p className="mt-2 text-sm text-charcoal-600">
          Enter the email address you used when uploading to verify and claim your photos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="claim-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error || undefined}
          autoComplete="email"
          autoFocus
          disabled={isLoading}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading}
          isLoading={isLoading}
        >
          {isLoading ? (
            'Checking...'
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Email enumeration protection message */}
      {showEnumerationProtection && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-gold-200 bg-gold-50/80 p-4"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold-600" />
          <div>
            <p className="text-sm font-medium text-charcoal-900">
              Verification link sent
            </p>
            <p className="mt-1 text-xs text-charcoal-600">
              If that email has photos in the archive, we'll send verification instructions.
            </p>
          </div>
        </motion.div>
      )}

      <p className="text-center text-xs text-charcoal-500">
        Your email is only used to verify photo ownership and will not be shared.
      </p>
    </motion.div>
  )
}
