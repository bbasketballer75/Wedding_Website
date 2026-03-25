# Skill: Testing with Vitest and Playwright

## Overview

This skill enables Codex to write and maintain tests using Vitest for unit tests and Playwright for E2E tests.

## Vitest (Unit/Integration Tests)

### Configuration

Vitest is configured in `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

### Running Tests

```bash
npm run test           # Run in watch mode
npm run test:run       # Run once
npm run test:ui        # Run with UI
npm run test:coverage  # Run with coverage report
```

### Writing Unit Tests

```typescript
// File: tests/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn, formatDate } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active')).toBe('base active')
    expect(cn('base', false && 'active')).toBe('base')
  })

  it('handles tailwind merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-06-15')
    expect(formatDate(date)).toBe('June 15, 2024')
  })
})
```

### Testing React Components

```typescript
// File: tests/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByText('Secondary')
    expect(button).toHaveClass('btn-secondary')
  })

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByText('Loading')).toBeDisabled()
  })
})
```

### Testing Hooks

```typescript
// File: tests/hooks/usePhotos.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePhotos } from '@/hooks/usePhotos'
import { supabase } from '@/lib/supabase'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: '1', url: 'photo1.jpg', category: 'wedding' },
              { id: '2', url: 'photo2.jpg', category: 'wedding' },
            ],
            error: null,
          })),
        })),
      })),
    })),
  },
}))

describe('usePhotos', () => {
  it('returns photos after loading', async () => {
    const { result } = renderHook(() => usePhotos('wedding'))

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.photos).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })
})
```

### Testing Async Operations

```typescript
// File: tests/lib/supabase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { uploadPhoto } from '@/lib/upload'
import { supabase } from '@/lib/supabase'

describe('uploadPhoto', () => {
  it('uploads file and returns public URL', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    const url = await uploadPhoto(file)
    
    expect(url).toMatch(/^https:\/\/.*\/storage\/v1\/object\/public/)
  })

  it('throws on upload error', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // Mock error response
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('Upload failed') }),
    } as any)

    await expect(uploadPhoto(file)).rejects.toThrow('Upload failed')
  })
})
```

## Playwright (E2E Tests)

### Configuration

Playwright config is in `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

### Running E2E Tests

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:public   # Run public-only tests
npm run test:e2e:ui       # Run with UI mode
npm run test:smoke        # Run smoke tests only
```

### Writing E2E Tests

```typescript
// File: e2e/gallery.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Gallery Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gallery')
  })

  test('displays page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Gallery/)
  })

  test('shows photo grid', async ({ page }) => {
    const photos = page.locator('[data-testid="photo-card"]')
    await expect(photos.first()).toBeVisible()
  })

  test('filters photos by category', async ({ page }) => {
    await page.selectOption('select[name="category"]', 'ceremony')
    
    const photos = page.locator('[data-testid="photo-card"]')
    await expect(photos.first()).toBeVisible()
  })

  test('opens lightbox on photo click', async ({ page }) => {
    await page.locator('[data-testid="photo-card"]').first().click()
    
    await expect(page.locator('[data-testid="lightbox"]')).toBeVisible()
  })
})
```

### Testing Forms

```typescript
// File: e2e/guestbook.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Guestbook', () => {
  test('submits message successfully', async ({ page }) => {
    await page.goto('/guestbook')
    
    // Fill form
    await page.fill('input[name="name"]', 'John Doe')
    await page.fill('input[name="email"]', 'john@example.com')
    await page.fill('textarea[name="message"]', 'Congratulations!')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Verify success
    await expect(page.locator('.success-message')).toBeVisible()
    await expect(page.locator('.success-message')).toContainText('Thank you')
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/guestbook')
    
    // Submit empty form
    await page.click('button[type="submit"]')
    
    // Check validation messages
    await expect(page.locator('input[name="name"]:invalid')).toBeVisible()
  })
})
```

### Accessibility Testing

```typescript
// File: e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('homepage has no accessibility violations', async ({ page }) => {
    await page.goto('/')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('body')
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('gallery is accessible', async ({ page }) => {
    await page.goto('/gallery')
    
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Disable if needed
      .analyze()
    
    expect(results.violations).toHaveLength(0)
  })
})
```

### Visual Regression Testing

```typescript
// File: e2e/visual.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Visual Regression', () => {
  test('homepage matches snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot('homepage.png')
  })

  test('gallery matches snapshot', async ({ page }) => {
    await page.goto('/gallery')
    await page.waitForSelector('[data-testid="photo-grid"]')
    
    expect(await page.screenshot()).toMatchSnapshot('gallery.png')
  })
})
```

### Smoke Tests

```typescript
// File: e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Smoke Tests @smoke', () => {
  const pages = ['/', '/gallery', '/guestbook', '/upload']

  for (const path of pages) {
    test(`${path} loads without errors`, async ({ page }) => {
      await page.goto(path)
      
      // Check no console errors
      const logs: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') logs.push(msg.text())
      })
      
      // Wait for page to settle
      await page.waitForLoadState('networkidle')
      
      expect(logs).toEqual([])
      expect(await page.title()).not.toContain('Error')
    })
  }
})
```

### Mobile Testing

```typescript
// File: e2e/mobile.spec.ts
import { test, expect, devices } from '@playwright/test'

test.use({
  ...devices['iPhone 14'],
})

test.describe('Mobile Experience', () => {
  test('gallery is responsive', async ({ page }) => {
    await page.goto('/gallery')
    
    // Check mobile layout
    const grid = page.locator('[data-testid="photo-grid"]')
    const box = await grid.boundingBox()
    
    expect(box?.width).toBeLessThanOrEqual(400)
  })

  test('navigation menu works', async ({ page }) => {
    await page.goto('/')
    
    // Open mobile menu
    await page.click('[data-testid="menu-button"]')
    
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
  })
})
```

## Best Practices

### Test Organization

```
tests/
├── setup.ts              # Test setup
├── utils.test.ts         # Utility tests
├── components/           # Component tests
│   ├── Button.test.tsx
│   └── Card.test.tsx
└── hooks/                # Hook tests
    └── usePhotos.test.ts

e2e/
├── fixtures/             # Test fixtures
├── home.spec.ts
├── gallery.spec.ts
├── guestbook.spec.ts
├── upload.spec.ts
├── a11y.spec.ts
└── smoke.spec.ts
```

### Test Data

```typescript
// File: tests/fixtures/photos.ts
export const mockPhotos = [
  {
    id: '1',
    url: 'https://example.com/photo1.jpg',
    thumbnail: 'https://example.com/thumb1.jpg',
    caption: 'First dance',
    category: 'reception',
    created_at: '2024-06-15T20:00:00Z',
  },
  {
    id: '2',
    url: 'https://example.com/photo2.jpg',
    thumbnail: 'https://example.com/thumb2.jpg',
    caption: 'Ceremony',
    category: 'ceremony',
    created_at: '2024-06-15T18:00:00Z',
  },
]
```

### Mocking Supabase

```typescript
// File: tests/mocks/supabase.ts
import { vi } from 'vitest'

export const createMockSupabase = (overrides = {}) => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    data: [],
    error: null,
    ...overrides,
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.jpg' } }),
    })),
  },
})
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Debugging Tests

### Vitest

```bash
# Debug specific test
npx vitest run tests/components/Button.test.ts --reporter=verbose

# Debug with UI
npm run test:ui
```

### Playwright

```bash
# Run in headed mode
npx playwright test --headed

# Debug specific test
npx playwright test e2e/gallery.spec.ts --debug

# Show report
npx playwright show-report
```
