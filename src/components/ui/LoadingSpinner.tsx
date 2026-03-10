import { motion } from 'framer-motion'
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'current'
  className?: string
  label?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
  label,
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4'
      case 'md':
        return 'w-6 h-6'
      case 'lg':
        return 'w-8 h-8'
      case 'xl':
        return 'w-12 h-12'
      default:
        return 'w-6 h-6'
    }
  }

  const getColorClasses = () => {
    switch (color) {
      case 'primary':
        return 'text-gold-500'
      case 'secondary':
        return 'text-dark-400 dark:text-cream-400'
      case 'white':
        return 'text-white'
      case 'current':
      default:
        return 'text-current'
    }
  }

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear' as const,
      },
    },
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <motion.svg
        variants={spinnerVariants}
        animate='animate'
        className={`${getSizeClasses()} ${getColorClasses()}`}
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        aria-hidden={label ? 'false' : 'true'}
        aria-label={label || 'Loading'}
      >
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
        />
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </motion.svg>
      {label && <span className='ml-3 text-sm font-medium tracking-wide text-dark-600 dark:text-cream-200'>{label}</span>}
    </div>
  )
}

// Loading overlay component
interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
  className?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  children,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='absolute inset-0 flex flex-col items-center justify-center bg-cream-50/80 dark:bg-dark-950/80 backdrop-blur-sm z-50'
        >
          <LoadingSpinner size='xl' />
          {message && <p className='mt-4 text-sm font-display tracking-wider text-dark-600 dark:text-cream-200'>{message}</p>}
        </motion.div>
      )}
    </div>
  )
}

// Page loading component
export const PageLoading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-cream-50 dark:bg-dark-950'>
      <LoadingSpinner size='xl' />
      <p className='mt-6 text-lg font-display tracking-widest text-dark-700 dark:text-cream-100'>{message}</p>
    </div>
  )
}

// Button loading component
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean
  loadingText?: string
  children: React.ReactNode
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center px-6 py-3 border border-transparent 
        text-sm font-medium rounded-full shadow-gold
        bg-gold-500 text-white
        hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-500
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-300
        ${className}
      `}
      {...props}
    >
      {isLoading && <LoadingSpinner size='sm' color='white' className='mr-2' />}
      {isLoading ? loadingText || 'Loading...' : children}
    </button>
  )
}

export default LoadingSpinner
