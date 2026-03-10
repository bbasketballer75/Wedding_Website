import { Variants } from 'framer-motion'

/**
 * Page transition variants for route changes
 */

export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
}

export const slideTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    x: '100%',
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    x: '-100%',
    transition: {
      duration: 0.4,
      ease: 'easeIn',
    },
  },
}

export const scaleTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
}

/**
 * Hook for managing page transitions
 */
export function usePageTransition(type: 'default' | 'slide' | 'scale' = 'default'): Variants {
  switch (type) {
    case 'slide':
      return slideTransitionVariants
    case 'scale':
      return scaleTransitionVariants
    default:
      return pageTransitionVariants
  }
}

export default usePageTransition
