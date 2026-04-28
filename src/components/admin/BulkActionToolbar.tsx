import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BulkActionToolbarProps {
  selectedCount: number
  onApproveAll: () => void
  onRejectAll: () => void
  onDeselectAll: () => void
  isLoading?: boolean
}

export function BulkActionToolbar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onDeselectAll,
  isLoading,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-2xl border border-gold-300/60 bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <span className="text-sm font-medium text-charcoal-700">
        {selectedCount} upload{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onDeselectAll}
          disabled={isLoading}
        >
          Deselect all
        </Button>
        <Button
          size="sm"
          onClick={onApproveAll}
          disabled={isLoading}
          className="bg-gold-500 hover:bg-gold-600"
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Approve all
        </Button>
        <Button
          size="sm"
          onClick={onRejectAll}
          disabled={isLoading}
          variant="danger"
          className="bg-rose-500 hover:bg-rose-600"
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Reject all
        </Button>
      </div>
    </motion.div>
  )
}