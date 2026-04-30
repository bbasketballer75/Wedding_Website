import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, Loader2, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { validateVerificationCode, generateVerificationCode, storeVerificationCode } from '@/lib/claimUtils'
import { useClaimStore } from '@/stores/claimStore'

interface CodeEntryProps {
  onCodeValidated: () => void
  email: string
}

/**
 * 6-digit code entry with countdown timer
 * Handles code verification with rate limiting (3 attempts max)
 */
export function CodeEntry({ onCodeValidated, email }: CodeEntryProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  const [expiryTime, setExpiryTime] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { setEmail: setStoreEmail, setVerificationMethod, setStep } = useClaimStore()

  // Set expiry time on mount (10 minutes from now)
  useEffect(() => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    setExpiryTime(expiresAt)
    setTimeRemaining(10 * 60) // 10 minutes in seconds
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!expiryTime) return

    const interval = setInterval(() => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000))
      setTimeRemaining(diff)

      if (diff === 0) {
        clearInterval(interval)
        setError('Code expired. Please request a new one.')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiryTime])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)

    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setError(null)

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const digits = pastedData.split('')

    const newCode = [...code]
    digits.forEach((digit, i) => {
      if (i < 6) newCode[i] = digit
    })
    setCode(newCode)

    // Focus last filled or first empty
    const lastFilledIndex = Math.min(digits.length, 5)
    inputRefs.current[lastFilledIndex]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullCode = code.join('')

    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    if (attemptsRemaining <= 0) {
      setError('Too many attempts. Please request a new code.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const isValid = await validateVerificationCode(email, fullCode)

      if (isValid) {
        setVerificationMethod('code')
        setStep('claimed')
        onCodeValidated()
      } else {
        const remaining = attemptsRemaining - 1
        setAttemptsRemaining(remaining)

        if (remaining <= 0) {
          setError('Too many attempts. Please request a new code.')
        } else {
          setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
        }
      }
    } catch (err) {
      console.error('Error validating code:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError(null)
    setCode(['', '', '', '', '', ''])

    try {
      const newCode = generateVerificationCode()
      await storeVerificationCode(email, newCode)

      // Reset timer
      const newExpiry = new Date(Date.now() + 10 * 60 * 1000)
      setExpiryTime(newExpiry)
      setTimeRemaining(10 * 60)
      setAttemptsRemaining(3)

      // Note: In production, this would send the code via email
      // For now, we just regenerate it in the database
    } catch (err) {
      console.error('Error resending code:', err)
      setError('Failed to resend code. Please try again.')
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
          <Lock className="h-6 w-6 text-gold-600" />
        </div>
        <h3 className="font-display text-2xl text-charcoal-900">
          Enter Verification Code
        </h3>
        <p className="mt-2 text-sm text-charcoal-600">
          We sent a 6-digit code to <span className="font-medium">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 6-digit code input */}
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="h-14 w-12 text-center text-xl font-semibold"
              disabled={isLoading || timeRemaining === 0}
            />
          ))}
        </div>

        {/* Countdown timer */}
        <div className="text-center">
          <p className={`text-sm ${timeRemaining <= 60 ? 'text-rose-500' : 'text-charcoal-500'}`}>
            Code expires in {formatTime(timeRemaining)}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-center text-sm text-rose-500">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading || timeRemaining === 0 || code.some(d => !d)}
          isLoading={isLoading}
        >
          {isLoading ? (
            'Verifying...'
          ) : (
            <>
              Verify Code
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={handleResendCode}
          disabled={isLoading}
          className="text-sm text-gold-600 hover:text-gold-700 transition-colors disabled:opacity-50"
        >
          Didn't receive the code? Resend
        </button>
      </div>
    </motion.div>
  )
}
