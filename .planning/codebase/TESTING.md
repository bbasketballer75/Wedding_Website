# Testing Patterns

**Analysis Date:** 2026-04-23

## Test Framework

**Unit/Rendering Tests:**
- Vitest 4.0.18 (`package.json`)
- Config: `vitest.config.js`
- Environment: jsdom
- Globals: true
- Setup file: `src/setupTests.jsx`
- Coverage provider: v8

**E2E Tests:**
- Playwright 1.58.2 (`package.json`)
- Config: `playwright.config.ts`
- Test directory: `tests/e2e/`
- Reporters: list + HTML
- Timeout: 60s (test), 10s (expect), 20s (navigation)

**Run Commands:**
```bash
npm test                  # Run all tests (vitest)
npm run test:ui           # Vitest UI
npm run test:run          # Single run (vitest)
npm run test:coverage     # With coverage
npm run test:e2e          # Full E2E suite
npm run test:e2e:public   # Public site E2E only
npm run test:ui           # Playwright UI
npm run test:smoke        # Smoke tests only
npm run test:visual       # Visual regression tests
```

## Test File Organization

**Unit Tests:**
- Co-located with source files using `.test.{ts,tsx}` suffix
- Example: `src/components/gallery/components/GalleryHeader.test.tsx`
- Example: `src/utils/storage.test.ts`
- Worker tests in `src/workers/__tests__/edge-cases.test.ts`

**E2E Tests:**
- All in `tests/e2e/` directory
- Spec files: `*.spec.ts` (Playwright)
- Support modules: `tests/e2e/support/*.ts`

## Test Structure

**Unit Test Suite:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

describe('ComponentName', () => {
  const defaultProps = {
    // Mock functions with vi.fn()
    setSearchQuery: vi.fn(),
    // Default values
    searchQuery: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<ComponentName {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('calls setSearchQuery on input change', () => {
    render(<ComponentName {...defaultProps} />)
    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'test' } })
    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('test')
  })
})
```

**E2E Test Suite:**
```typescript
import { test, expect, gotoPublicPage, pauseMedia } from './support/publicSite'

test.describe('Feature Name', () => {
  test('does something', async ({ page }) => {
    await gotoPublicPage(page, '/')
    await expect(page.getByRole('button', { name: /Action/i })).toBeVisible()
  })

  test('visual baseline', async ({ page }) => {
    await gotoPublicPage(page, '/')
    await pauseMedia(page)
    await expectSectionScreenshot(page.locator('[data-testid="section"]'), 'snapshot-name.png')
  })
})
```

## Mocking

**Framework:** Vitest `vi` for unit tests, Playwright `page.route()` for E2E

**Unit Test Patterns:**
```typescript
// Mock framer-motion in setupTests.jsx
vi.mock('framer-motion', () => {
  const React = require('react')
  const MotionComponent = ({ children, ...props }: any) => React.createElement('div', props, children)
  return {
    motion: { div: MotionComponent, span: MotionComponent, button: MotionComponent },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Inline mocks for components
vi.mock('@/components/ui/DynamicTitle', () => ({
  default: () => null,
}))
```

**E2E Mock Patterns:**
```typescript
// Mock API routes in support file
export async function installPublicSiteMocks(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname.includes('/rest/v1/photos')) {
      await fulfillJson(route, galleryPhotos)
      return
    }

    await route.continue()
  })
}

// Use Page Object pattern via test.extend
export const test = base.extend({
  page: async ({ page }, runPage) => {
    await preparePublicPage(page)
    await installPublicSiteMocks(page)
    await runPage(page)
  },
})
```

**What to Mock:**
- Browser-only APIs: localStorage, matchMedia, IntersectionObserver, ResizeObserver
- Large libraries: framer-motion, leaflet
- External services: Supabase API responses
- Components that are tested separately

**What NOT to Mock:**
- Native browser APIs being tested
- Utilities that are the subject of the test
- Simple pure functions

## Fixtures and Factories

**Test Data:**
- Mock data in `tests/e2e/support/mockData.ts` and `tests/e2e/support/adminMockData.ts`
- Factory patterns for creating test objects
- Static arrays of fixture data

**Global Test Setup:**
- `src/setupTests.jsx` provides global mocks for all unit tests
- ResizeObserver, IntersectionObserver, matchMedia, localStorage mocks
- Framer-motion mock with common motion components

## Coverage

**Requirements:** Not explicitly enforced, but coverage reporting available

**View Coverage:**
```bash
npm run test:coverage   # Generates text, json, html reports
```

**Excluded from Coverage:**
- `node_modules/`
- `tests/`
- `**/*.config.*`
- `**/dist/**`

## Test Types

**Unit Tests:**
- Component rendering tests
- Utility function tests
- Store/state management tests
- Zod validation tests

**Integration Tests:**
- API mocking at network level (E2E with mocked backend)
- Page-level testing with mocked data

**E2E Tests:**
- Public site: home, film, gallery, upload, guestbook, a11y, shell, smoke, seo, people
- Admin site: admin-auth, admin-a11y, admin-shell, admin-visuals, admin-workflows
- Visual regression with screenshot comparison

**Smoke Tests:**
- Run with `@smoke` tag: `npm run test:smoke`
- Quick sanity checks

## Common Patterns

**Async Testing:**
```typescript
await waitFor(() => {
  expect(screen.getByText(/expected/i)).toBeInTheDocument()
})
```

**Error Testing:**
```typescript
try {
  await analyzeImage({ width: 100, height: 100 } as ImageData)
} catch (e: unknown) {
  expect((e as Error).message).toBe('Failed to get 2d context')
}
```

**Visual Regression:**
- Screenshot baseline files in `tests/e2e/**/*.{spec,}-snapshots/`
- Uses `expect(locator).toHaveScreenshot()` with maxDiffPixelRatio: 0.015
- Animations disabled, caret hidden
- Scrollbar-gutter stabilization on Windows

**Accessibility Testing:**
- AxeBuilder integration: `expectNoCriticalViolations(page)`
- Keyboard navigation tests
- Focus visibility tests

---

*Testing analysis: 2026-04-23*
