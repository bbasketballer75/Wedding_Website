import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, CheckCircle } from 'lucide-react'
import { useClaimStore } from '@/stores/claimStore'
import { sendMagicLink, claimPhotosWithEmail } from '@/lib/claimUtils'
import { EmailEntryForm } from './EmailEntryForm'
import { CodeEntry } from './CodeEntry'
import { ClaimedConfirmation } from './ClaimedConfirmation'
import { Button } from '@/components/ui/Button'

interface ClaimFlowProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Main orchestrating component for the photo claiming flow
 * Renders appropriate sub-component based on current step
 */
export function ClaimFlow({ isOpen, onClose }: ClaimFlowProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    step,
    email,
    claimablePhotos,
    setVerificationMethod,
    setStep,
    completeClaim,
    reset,
  } = useClaimStore()

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleEmailSubmitted = async () => {
    if (!email || claimablePhotos.length === 0) {
      // No photos found - just close (enumeration protection message already shown)
      return
    }

    // Show verification method selection
    setStep('verification_sent')
  }

  const handleMagicLink = async () => {
    if (!email) return

    setIsLoading(true)
    setError(null)

    try {
      // Send magic link via Supabase
      await sendMagicLink(email)

      // After sending, the magic link will redirect to /verify
      // For now, we'll simulate the claim since magic links require email access
      // In production, the user would click the link in their email

      // For demo purposes, directly claim the photos if they have them
      if (claimablePhotos.length > 0) {
        await claimPhotosWithEmail(email)
        completeClaim()
      }

      setStep('claimed')
    } catch (err) {
      console.error('Error sending magic link:', err)
      setError('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeMethod = () => {
    setVerificationMethod('code')
    setStep('code_entry')
  }

  const handleCodeValidated = () => {
    // CodeEntry already calls completeClaim via store
    // Nothing more to do here
  }

  const handleClaimedViewPhotos = () => {
    handleClose()
    // Navigation to /gallery?collection=MyPhotos happens via ClaimedConfirmation link
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-gold-100 px-6 py-4">
            <h2 className="font-display text-xl text-charcoal-900">
              Claim Your Photos
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-charcoal-400 transition-colors hover:bg-gold-50 hover:text-charcoal-600"
              aria-label="Close claim dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 'idle' && (
                <EmailEntryForm key="email-entry" onEmailSubmitted={handleEmailSubmitted} />
              )}

              {step === 'verification_sent' && (
                <motion.div
                  key="verification-sent"
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
                      Choose Verification Method
                    </h3>
                    <p className="mt-2 text-sm text-charcoal-600">
                      {claimablePhotos.length > 0 ? (
                        <>We found {claimablePhotos.length} photo{claimablePhotos.length !== 1 ? 's' : ''} to claim.</>
                      ) : (
                        <>Enter your email to verify.</>
                      )}
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="text-center text-sm text-rose-500">
                      {error}
                    </p>
                  )}

                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={handleMagicLink}
                      disabled={isLoading}
                      isLoading={isLoading}
                    >
                      <Mail className="h-5 w-5" />
                      Send Magic Link
                    </Button>

                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      onClick={handleCodeMethod}
                      disabled={isLoading}
                    >
                      <Lock className="h-5 w-5" />
                      Enter 6-Digit Code
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 'code_entry' && email && (
                <CodeEntry
                  key="code-entry"
                  onCodeValidated={handleCodeValidated}
                  email={email}
                />
              )}

              {step === 'claimed' && (
                <ClaimedConfirmation
                  key="claimed"
                  photoCount={claimablePhotos.length}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
