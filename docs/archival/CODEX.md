# CODEX Project Guide: Austin & Jordyn's Wedding Website

## Project Overview

This is a **React + Vite + TypeScript** wedding website with:

- **Frontend**: React 19, Tailwind CSS 4, Framer Motion
- **Backend**: Supabase (PostgreSQL + Storage)
- **Testing**: Vitest + Playwright
- **Deployment**: Netlify + Cloudflare
- **PWA**: Enabled with offline support

Live site: https://www.theporadas.com

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test
npm run test:e2e

# Build for production
npm run build
```

## Architecture

### Frontend Stack

- **React 19** - UI library
- **React Router 7** - Client-side routing
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **Zod** - Schema validation

### Backend Stack

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Storage for photos/videos
  - Row Level Security (RLS) policies
- **Cloudflare R2** - Large media storage

### Advanced Features

- **PWA** - Progressive Web App with offline support
- **Face Detection** - AI-powered face recognition for photos
- **Admin Panel** - Photo moderation, face tagging, gallery curation
- **Media Pipeline** - Batch processing for photos (optimize, tag, publish)
- **digiKam Integration** - Professional photo management workflow
- **Accessibility** - WCAG 2.1 AA compliant

### Project Structure

```
src/
├── components/        # React components
│   ├── ui/           # Reusable UI components
│   ├── layout/       # Layout components
│   └── features/     # Feature-specific components
├── pages/            # Route pages
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries
│   ├── supabase.ts   # Supabase client
│   └── utils.ts      # Utility functions
├── types/            # TypeScript types
├── styles/           # Global styles
├── stores/           # Zustand stores
├── pwa/              # PWA configuration
├── accessibility/    # Accessibility utilities
├── design-system/    # Design tokens and theme
└── features/         # Feature modules
    ├── gallery/      # Gallery feature
    ├── guestbook/    # Guestbook feature
    └── admin/        # Admin panel
```

## Key Files

### Configuration

- `vite.config.js` - Vite configuration with PWA support
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `.env` - Environment variables (see `.env.example`)

### Documentation

- `README-DEPLOY.md` - Deployment overview
- `SUPABASE_CLI_GUIDE.md` - Supabase CLI operations
- `GALLERY_OPERATIONS.md` - Photo curation workflow
- `LAUNCH_RUNBOOK.md` - Launch procedures

## Development Guidelines

### Code Style

- **ESLint** + **Prettier** for linting and formatting
- **TypeScript** strict mode enabled
- Use **functional components** with hooks
- Prefer **named exports** over default exports

### Component Patterns

```tsx
// Use type instead of interface for props
type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}

// Export function component with named export
export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button className={cn('btn', variant === 'primary' && 'btn-primary')} onClick={onClick}>
      {children}
    </button>
  )
}
```

### Styling Guidelines

- Use **Tailwind CSS** for all styling
- Use `cn()` utility from `lib/utils.ts` for conditional classes
- Use **CSS variables** for theme colors
- Follow mobile-first responsive design

### State Management

- Use **Zustand** for global state
- Use **React Query** (if needed) for server state
- Prefer local state for component-specific data

## Supabase Guidelines

### Database Access

```typescript
// Always use the typed supabase client
import { supabase } from '@/lib/supabase'

// Example query
const { data, error } = await supabase
  .from('photos')
  .select('*')
  .eq('category', 'wedding')
  .order('created_at', { ascending: false })
```

### RLS Policies

- All tables have Row Level Security enabled
- Public read access for photos and approved content
- Public insert for guestbook and uploads
- No anonymous updates/deletes

### Storage Buckets

- `guest-photos` - Guest uploaded photos
- `guest-videos` - Guest uploaded videos
- `guest-voice-messages` - Voice messages

## Testing Guidelines

### Unit Tests (Vitest)

```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once
npm run test:coverage  # Run with coverage
```

### E2E Tests (Playwright)

```bash
npm run test:e2e         # Run all E2E tests
npm run test:e2e:public  # Run public-only tests
npm run test:e2e:ui      # Run with UI mode
```

### Test Files

- Unit tests: `tests/*.test.ts` or `src/**/*.test.ts`
- E2E tests: `e2e/*.spec.ts`

## Common Commands

### Development

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run preview      # Preview production build
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run fix          # Run lint:fix + format
```

### Supabase

```bash
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run supabase:status  # Check status
npm run supabase:types   # Generate TypeScript types
```

### Media Operations

```bash
npm run media:batch:catalog    # Catalog photo batch
npm run media:batch:organize   # Organize photos
npm run media:batch:optimize   # Optimize images
npm run media:batch:publish    # Publish to CDN
```

## Environment Variables

Required in `.env`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Media CDN
VITE_MEDIA_BASE_URL=https://media.wedding.theporadas.com

# Optional: Sentry
VITE_SENTRY_DSN=your-sentry-dsn
```

## Deployment

### Production Deployment

1. Run verification: `npm run verify:release`
2. Build: `npm run build`
3. Deploy to Netlify

### Verification Commands

```bash
npm run verify:env       # Verify environment
npm run verify:supabase  # Verify Supabase connection
npm run verify:deployed  # Verify deployed site
npm run verify:launch    # Full launch verification
```

## Troubleshooting

### Common Issues

1. **Type errors**: Run `npx tsc --noEmit` to check
2. **Build errors**: Check `vite.config.js` for plugin issues
3. **Supabase errors**: Verify env vars and RLS policies
4. **Test failures**: Ensure dev server is not running on same port
5. **Media workflow errors**: Check `MEDIA_BATCH_WORKFLOW.md` for detailed steps
6. **Face detection issues**: Ensure model files exist in `node_modules/@vladmandic/human/models/`

### Getting Help

- Check `README-DEPLOY.md` for deployment issues
- Check `SUPABASE_CLI_GUIDE.md` for Supabase issues
- Check `GALLERY_OPERATIONS.md` for photo workflow issues
- Check `MEDIA_BATCH_WORKFLOW.md` for batch processing

## Codex Skills Available

The `.codex/skills/` directory contains detailed guides for:

1. **react-vite** - React + Vite development patterns
2. **supabase** - Database and storage operations
3. **testing** - Vitest and Playwright testing
4. **deployment** - Netlify and Cloudflare deployment
5. **media-workflow** - Photo batch processing and face tagging
6. **pwa** - Progressive Web App features
7. **accessibility** - WCAG compliance and a11y patterns

Reference these skills when prompting Codex for specific tasks.

## Figma Integration

Figma Dev Mode MCP is configured via `.mcp.json` in the project root (gitignored — contains API token).
This allows Claude Code to read Figma files directly for design reference and code connect.

**Setup:** Requires a Figma Personal Access Token in `.mcp.json` under `mcpServers.figma.env.FIGMA_ACCESS_TOKEN`.
Generate one at Figma → Settings → Security → Personal access tokens.
Copy `.mcp.json.example` to `.mcp.json` and replace the token value.

**Usage:** In any Claude Code session, share a Figma file URL and the MCP will read component specs,
variables, and annotations without leaving the terminal.

**Design system mapping:** Figma variable names should match keys in `src/design-system/tokens.ts`
so design tokens stay in sync between Figma and code.
