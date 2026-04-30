import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useClaimStore } from '@/stores/claimStore'
import { claimPhotosWithEmail, sendMagicLink } from '@/lib/claimUtils'
import { supabase } from '@/lib/supabase'

/**
 * Verification handler page for magic link and code entry flows
 * Handles redirects from Supabase magic link emails
 */
export default function VerifyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { email, setEmail, completeClaim, setStep } = useClaimStore()

  useEffect(() => {
    const handleVerification = async () => {
      // Check for Supabase auth token in URL (magic link callback)
      const token = searchParams.get('token')
      const type = searchParams.get('type')
      const emailParam = searchParams.get('email')

      // If we have a token from magic link
      if (token) {
        try {
          // Verify the OTP token from Supabase
          const { data, error } = await supabase.auth.verifyOtp({
            type: 'email',
            token,
            email: emailParam || email || '',
          })

          if (error) {
            console.error('OTP verification error:', error)
            setStatus('error')
            setErrorMessage(error.message || 'Verification failed')
            return
          }

          // Successfully verified - claim the photos
          if (emailParam || email) {
            const verifiedEmail = emailParam || email
            try {
              await claimPhotosWithEmail(verifiedEmail)
              completeClaim()
              setStatus('success')
              // Redirect to gallery with My Photos collection after a short delay
              setTimeout(() => {
                navigate('/gallery?collection=MyPhotos')
              }, 2000)
            } catch (claimError) {
              console.error('Claim error:', claimError)
              setStatus('error')
              setErrorMessage('Could not claim photos. Please try again.')
            }
          } else {
            setStatus('error')
            setErrorMessage('Email not found in verification link')
          }
        } catch (err) {
          console.error('Verification error:', err)
          setStatus('error')
          setErrorMessage('Something went wrong during verification')
        }
        return
      }

      // Check for code-based verification (redirect from code entry)
      const code = searchParams.get('code')
      if (code && email) {
        // The code validation happens on the client side in CodeEntry component
        // This page handles the magic link flow primarily
        setStatus('error')
        setErrorMessage('Code verification should be completed on the page that generated the code')
        return
      }

      // No token or code - redirect to upload page
      setStatus('error')
      setErrorMessage('Invalid verification link')
      setTimeout(() => {
        navigate('/upload')
      }, 3000)
    }

    handleVerification()
  }, [searchParams, email, navigate, completeClaim, setEmail, setStep])

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] px-4 pb-20 pt-32">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 text-center sm:px-10"
        >
          <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-gold-500/8 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-gold-400/5 blur-3xl" />

          <div className="relative">
            {status === 'verifying' && (
              <>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-gold-400/25 bg-gold-500/10 shadow-sm"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-gold-400" />
                </motion.div>

                <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400 mt-6">
                  Verifying your email
                </span>

                <h1 className="mt-6 text-3xl text-white sm:text-4xl">
                  One moment while we verify your email...
                </h1>
              </>
            )}

            {status === 'success' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm"
                >
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </motion.div>

                <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-green-400 mt-6">
                  Verification complete
                </span>

                <h1 className="mt-6 text-3xl text-white sm:text-4xl">
                  Your photos have been claimed!
                </h1>

                <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
                  Redirecting you to your photos...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 shadow-sm"
                >
                  <XCircle className="h-10 w-10 text-rose-400" />
                </motion.div>

                <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-rose-400 mt-6">
                  Verification failed
                </span>

                <h1 className="mt-6 text-3xl text-white sm:text-4xl">
                  Something went wrong
                </h1>

                <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
                  {errorMessage || 'We could not verify your email. Please try again.'}
                </p>

                <div className="mt-6">
                  <button
                    onClick={() => navigate('/upload')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/20 px-6 py-3 text-sm text-gold-300 transition-colors hover:bg-gold-500/30"
                  >
                    Return to Upload Page
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
