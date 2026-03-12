/**
 * Shared Framer Motion variants for the live public app.
 */
import { Variants } from 'framer-motion'

/**
 * Common animation variants for reuse across components
 */

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -50,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: 50,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

export const staggerChildrenVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
}

/**
 * Animation timing constants
 */
export const animationTimings = {
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  verySlow: 1.0,
}

/**
 * Easing functions
 */
export const easings = {
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
}

/**
 * Create custom fade variant with configurable duration
 */
export const createFadeVariant = (duration: number = 0.6): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration * 0.5, ease: 'easeIn' },
  },
})

/**
 * Create custom slide variant with configurable direction and distance
 */
export const createSlideVariant = (
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  distance: number = 50,
  duration: number = 0.6
): Variants => {
  const axis = direction === 'up' || direction === 'down' ? 'y' : 'x'
  const initialValue = direction === 'up' || direction === 'left' ? distance : -distance
  const hidden = { opacity: 0, x: 0, y: 0 }
  const visible = {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration, ease: 'easeOut' as const },
  }
  const exit = {
    opacity: 0,
    x: 0,
    y: 0,
    transition: { duration: duration * 0.5, ease: 'easeIn' as const },
  }

  hidden[axis] = initialValue
  exit[axis] = -initialValue

  return {
    hidden,
    visible,
    exit,
  }
}

/**
 * Create stagger container variant
 */
export const createStaggerVariant = (
  staggerDelay: number = 0.1,
  delayChildren: number = 0.2
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren,
    },
  },
})

export default {
  fadeInVariants,
  slideUpVariants,
  slideDownVariants,
  scaleVariants,
  staggerChildrenVariants,
  listItemVariants,
  animationTimings,
  easings,
  createFadeVariant,
  createSlideVariant,
  createStaggerVariant,
}
