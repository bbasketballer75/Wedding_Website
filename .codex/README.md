# Codex Configuration for Wedding Website

This directory contains the Codex configuration and skills for developing the Austin & Jordyn Wedding Website.

## Quick Start

1. **Install Codex CLI** (if not already installed):
   ```bash
   npm install -g @openai/codex
   ```

2. **Start Codex** in the project root:
   ```bash
   codex
   ```

3. **Reference the documentation**:
   - `CODEX.md` - Main project guide
   - `.codex/skills/` - Detailed skill references

## Directory Structure

```
.codex/
├── README.md           # This file
├── config.yaml         # Codex configuration
└── skills/
    ├── react-vite.md   # React + Vite + TypeScript
    ├── supabase.md     # Supabase integration
    ├── testing.md      # Vitest + Playwright
    └── deployment.md   # Netlify + Cloudflare
```

## Available Skills

### 1. React + Vite Development (`react-vite.md`)
- Component patterns and conventions
- Custom hooks
- Tailwind CSS styling
- Framer Motion animations
- Routing with React Router

### 2. Supabase Integration (`supabase.md`)
- Database CRUD operations
- Storage bucket operations
- Real-time subscriptions
- RLS policies
- Type generation

### 3. Testing (`testing.md`)
- Unit tests with Vitest
- E2E tests with Playwright
- Component testing
- Accessibility testing
- Visual regression testing

### 4. Deployment (`deployment.md`)
- Netlify deployment
- Cloudflare CDN/R2
- Environment variables
- Rollback procedures
- Monitoring and alerts

### 5. Media Workflow (`media-workflow.md`)
- Photo batch processing pipeline
- Face detection and tagging
- digiKam integration
- Gallery curation workflow
- Guest upload handling

### 6. PWA (`pwa.md`)
- Service worker configuration
- Offline support
- App manifest
- Install prompts
- Background sync

### 7. Accessibility (`accessibility.md`)
- WCAG 2.1 AA compliance
- Semantic HTML patterns
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Focus management

## Configuration Reference

The `config.yaml` file defines:
- Project type and language
- Enabled skills
- File include/exclude patterns
- Available commands
- Key documentation files

## Usage Tips

### Referencing Skills

When working with Codex, reference specific skills:

```
"Using the react-vite skill, create a new PhotoGallery component..."
"Following the testing skill, write tests for this hook..."
"Per the supabase skill, add a query for photos..."
```

### Common Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview build

# Testing
npm run test         # Unit tests
npm run test:e2e     # E2E tests

# Code quality
npm run lint         # ESLint
npm run format       # Prettier
npx tsc --noEmit     # Type check

# Verification
npm run verify:release  # Full pre-deploy check
```

### Project Context

Key context for Codex:
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Storage)
- **Testing**: Vitest + Playwright
- **Deployment**: Netlify + Cloudflare
- **Live URL**: https://www.theporadas.com

## Development Workflow

1. **Start**: `npm run dev`
2. **Code**: Make changes in `src/`
3. **Test**: `npm run test` and `npm run test:e2e`
4. **Verify**: `npm run verify:release`
5. **Deploy**: Push to main (auto-deploys via Netlify)

## Getting Help

- Check `CODEX.md` in the project root
- Review relevant skill files in `.codex/skills/`
- See `README-DEPLOY.md` for deployment details
- See `SUPABASE_CLI_GUIDE.md` for database operations
- See `GALLERY_OPERATIONS.md` for photo workflows
