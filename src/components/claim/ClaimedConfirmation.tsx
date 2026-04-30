import { motion } from 'framer-motion'
import { CheckCircle, Camera, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import { useClaimStore } from '@/stores/claimStore'

interface ClaimedConfirmationProps {
  photoCount: number
}

/**
 * Success message after photos have been claimed
 * Shows confirmation with button to view claimed photos in gallery
 */
export function ClaimedConfirmation({ photoCount }: ClaimedConfirmationProps) {
  const { attributedEmail } = useClaimStore()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
        >
          <CheckCircle className="h-8 w-8 text-green-600" />
        </motion.div>
        <h3 className="font-display text-2xl text-charcoal-900">
          Photos Claimed!
        </h3>
        <p className="mt-2 text-sm text-charcoal-600">
          Your {photoCount} photo{photoCount !== 1 ? 's' : ''} have been verified and attributed to you.
          {attributedEmail && (
            <span className="mt-1 block text-xs text-charcoal-500">
              Verified email: {attributedEmail}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          asChild
        >
          <Link to="/gallery?collection=MyPhotos">
            <Camera className="h-5 w-5" />
            View My Photos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          asChild
        >
          <Link to="/gallery">
            Browse Gallery
          </Link>
        </Button>
      </div>

      <p className="text-center text-xs text-charcoal-500">
        Your photos will now appear with your name when others view them.
      </p>
    </motion.div>
  )
}
