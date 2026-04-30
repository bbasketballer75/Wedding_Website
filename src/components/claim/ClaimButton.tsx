import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ClaimButtonProps {
  onClick: () => void
  disabled?: boolean
}

/**
 * Gold-styled "Claim My Photos" button
 * Opens the ClaimFlow modal/drawer
 */
export function ClaimButton({ onClick, disabled }: ClaimButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        variant="primary"
        size="lg"
        onClick={onClick}
        disabled={disabled}
        className="gap-2"
      >
        <Camera className="h-5 w-5" />
        Claim My Photos
      </Button>
    </motion.div>
  )
}
