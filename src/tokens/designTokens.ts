// Wedding Website Design Tokens
// Aligned with src/index.css Tailwind v4 Theme

export const colors = {
  gold: {
    50: '#f7eed8',
    100: '#ecdfb8',
    200: '#dcc68a',
    300: '#c9af6c',
    400: '#b69350',
    500: '#d4af37', // Primary Brand Gold
    600: '#7d5e2c',
    700: '#5e451e',
    800: '#3f2e13',
    900: '#2a1f0c',
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
    900: '#0a0908',
    800: '#131110',
    700: '#1d1b19',
    600: '#2a2624',
    500: '#3a3532',
    400: '#4f4945',
    gray: '#4f4945',
  },
} as const

export const typography = {
  fontFamily: {
    display: "'Newsreader', Georgia, serif",
    body: "'Instrument Sans', 'Outfit', system-ui, sans-serif",
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
