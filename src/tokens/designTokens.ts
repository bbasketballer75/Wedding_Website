// Wedding Website Design Tokens
// Aligned with src/index.css Tailwind v4 Theme

export const colors = {
  gold: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#d4af37', // Primary Brand Gold
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  cream: {
    50: '#fefdfb',
    100: '#fbfaf8',
    200: '#f8f6f2',
    300: '#f0ede8',
    400: '#e8e3db',
    500: '#d6d3ce',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#e2b4b4',
  },
  sage: {
    50: '#f6f8f6',
    100: '#ecf0ec',
    500: '#a3b1a3',
  },
  neutral: {
    white: '#ffffff',
    black: '#000000',
    900: '#0a0a0a',
    800: '#171717',
    700: '#262626',
    gray: '#737373',
  },
} as const

export const typography = {
  fontFamily: {
    display: "'Cormorant Garamond', serif",
    body: "'Inter', sans-serif",
    script: "'Allura', cursive",
  },
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const

export const spacing = {
  container: 'max(1rem, 5vw)',
  section: 'max(4rem, 8vh)',
} as const

export const components = {
  button: {
    radius: '9999px',
    padding: '0.75rem 1.5rem',
  },
  card: {
    radius: '1rem',
    padding: '2rem',
  },
} as const

export default {
  colors,
  typography,
  spacing,
  components,
}
