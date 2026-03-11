// Wedding Website Design Tokens
// Aligned with src/index.css Tailwind v4 Theme

export const colors = {
  gold: {
    50: '#fdfbf7',
    100: '#f9f4eb',
    200: '#f2e8d5',
    300: '#e8d4b0',
    400: '#dbb880',
    500: '#c9a05c', // Primary Brand Gold
    600: '#a6824a',
    700: '#85633b',
    800: '#6d5135',
    900: '#5a432e',
  },
  cream: {
    50: '#fdfcfa',
    100: '#faf8f4',
    200: '#f5f2ec',
    300: '#efeae2',
    400: '#e8e2d8',
    500: '#d8d0c4',
  },
  rose: {
    50: '#fdf8f9',
    100: '#fcecef',
    200: '#f9dbe2',
    300: '#f5c6d0',
    400: '#ee9fb0',
    500: '#e36a83',
  },
  sage: {
    50: '#f5f8f5',
    100: '#f0f4f0',
    200: '#d4ddd4',
    300: '#b8c9b8',
    500: '#8aa08a',
  },
  neutral: {
    white: '#ffffff',
    black: '#000000',
    900: '#151413',
    800: '#1f1d1b',
    700: '#2d2b28',
    600: '#3d3a36',
    500: '#4a4642',
    400: '#6b6560',
    gray: '#6b6560',
  },
} as const

export const typography = {
  fontFamily: {
    display: "'Bodoni Moda', 'Cormorant Garamond', Georgia, serif",
    body: "'Manrope', 'Outfit', system-ui, sans-serif",
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
