import React, { Suspense } from 'react'
import { motion } from 'framer-motion'
import { ANIMATION_DURATIONS } from '@/config/constants'

// Loading spinner component
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
}
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  }

  return (
    <div className='flex items-center justify-center p-8'>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-pink-600`}
      />
    </div>
  )
}

// Lazy load wrapper for components
interface LazyLoadProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
  className?: string;
}

const LazyLoad: React.FC<LazyLoadProps> = ({ children, fallback = <LoadingSpinner />, delay = 0, className = '' }) => {
  const [showContent, setShowContent] = React.useState(delay === 0)

  React.useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => {
        setShowContent(true)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  if (!showContent) {
    return <div className={className}>{fallback}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: ANIMATION_DURATIONS.normal / 1000 }}
      className={className}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </motion.div>
  )
}

export default LazyLoad
