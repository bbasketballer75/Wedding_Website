/**
 * Design Tokens
 * Centralized design system values
 */

export const colors = {
  // Brand colors
  primary: {
    50: '#FDF8F3',
    100: '#F9EFE0',
    200: '#F3DFC1',
    300: '#EDCFA2',
    400: '#E7BF83',
    500: '#D4AF37', // Gold - Main brand color
    600: '#B89730',
    700: '#9C7F29',
    800: '#806722',
    900: '#644F1B',
  },

  // Secondary colors
  sage: {
    50: '#F5F7F4',
    100: '#E8EDE5',
    200: '#D1DBD0',
    300: '#BAC9BB',
    400: '#A3B7A6',
    500: '#87A96B', // Sage Green
    600: '#6D8A56',
    700: '#536B41',
    800: '#394C2C',
    900: '#1F2D17',
  },

  blush: {
    50: '#FEF9F9',
    100: '#FDF0F0',
    200: '#FBE0E0',
    300: '#F9D0D0',
    400: '#F7C0C0',
    500: '#F5C0C0', // Blush Pink
    600: '#E09999',
    700: '#CB7373',
    800: '#B64C4C',
    900: '#A12626',
  },

  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',

  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic colors
  success: {
    light: '#D1FAE5',
    main: '#10B981',
    dark: '#065F46',
  },

  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#991B1B',
  },

  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#92400E',
  },

  info: {
    light: '#DBEAFE',
    main: '#3B82F6',
    dark: '#1E40AF',
  },
}

export const typography = {
  // Font families
  fontFamily: {
    heading: "'Cormorant Garamond', serif",
    body: "'Inter', sans-serif",
    script: "'Allura', cursive",
    mono: "'Fira Code', monospace",
  },

  // Font sizes
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem', // 48px
    '6xl': '3.75rem', // 60px
    '7xl': '4.5rem', // 72px
    '8xl': '6rem', // 96px
    '9xl': '8rem', // 128px
  },

  // Font weights
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Line heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
}

export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  7: '1.75rem', // 28px
  8: '2rem', // 32px
  9: '2.25rem', // 36px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  14: '3.5rem', // 56px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
  28: '7rem', // 112px
  32: '8rem', // 128px
  36: '9rem', // 144px
  40: '10rem', // 160px
  44: '11rem', // 176px
  48: '12rem', // 192px
  52: '13rem', // 208px
  56: '14rem', // 224px
  60: '15rem', // 240px
  64: '16rem', // 256px
  72: '18rem', // 288px
  80: '20rem', // 320px
  96: '24rem', // 384px
}

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  none: 'none',
}

export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  base: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  '2xl': '1rem', // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
}

export const transitions = {
  duration: {
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
  },

  timing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
}

export const zIndex = {
  0: 0,
  10: 10,
  20: 20,
  30: 30,
  40: 40,
  50: 50,
  auto: 'auto',
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
}

export const animation = {
  fadeIn: {
    keyframes: {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 },
    },
    duration: transitions.duration[300],
    timing: transitions.timing.out,
  },

  fadeOut: {
    keyframes: {
      '0%': { opacity: 1 },
      '100%': { opacity: 0 },
    },
    duration: transitions.duration[300],
    timing: transitions.timing.in,
  },

  slideInUp: {
    keyframes: {
      '0%': { transform: 'translateY(100%)', opacity: 0 },
      '100%': { transform: 'translateY(0)', opacity: 1 },
    },
    duration: transitions.duration[500],
    timing: transitions.timing.out,
  },

  slideInDown: {
    keyframes: {
      '0%': { transform: 'translateY(-100%)', opacity: 0 },
      '100%': { transform: 'translateY(0)', opacity: 1 },
    },
    duration: transitions.duration[500],
    timing: transitions.timing.out,
  },

  scaleIn: {
    keyframes: {
      '0%': { transform: 'scale(0.9)', opacity: 0 },
      '100%': { transform: 'scale(1)', opacity: 1 },
    },
    duration: transitions.duration[300],
    timing: transitions.timing.spring,
  },

  spin: {
    keyframes: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
    duration: transitions.duration[1000],
    timing: transitions.timing.linear,
  },
}

/**
 * Design tokens export
 */
export const tokens = {
  colors,
  typography,
  spacing,
  breakpoints,
  shadows,
  borderRadius,
  transitions,
  zIndex,
  animation,
}

export default tokens
