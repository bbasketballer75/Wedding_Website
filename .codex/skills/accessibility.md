# Skill: Accessibility (a11y)

## Overview

This skill enables Codex to implement and maintain WCAG-compliant accessibility features for the wedding website.

## Accessibility Standards

Target: **WCAG 2.1 Level AA**

### Compliance Areas

| Area | Requirements |
|------|--------------|
| **Perceivable** | Text alternatives, captions, color contrast |
| **Operable** | Keyboard navigation, focus management, timing |
| **Understandable** | Readable text, predictable navigation |
| **Robust** | Screen reader support, valid markup |

## Color Contrast

### Minimum Ratios (WCAG AA)

| Usage | Ratio | Example |
|-------|-------|---------|
| Normal text | 4.5:1 | Body text |
| Large text (18px+) | 3:1 | Headings |
| UI components | 3:1 | Buttons, inputs |

### Current Theme Colors

```css
:root {
  --color-primary: #d4af37;      /* Gold - check contrast on dark */
  --color-secondary: #08080a;     /* Near black */
  --color-background: #08080a;    /* Dark background */
  --color-surface: #121214;       /* Card backgrounds */
  --color-text: #f5f5f5;          /* Light text */
  --color-text-muted: #a1a1aa;    /* Muted text */
}
```

### Contrast Check

```bash
# Use axe or lighthouse to check
npm run test:e2e -- tests/e2e/a11y.spec.ts
```

## Semantic HTML

### Page Structure

```tsx
// Good: Semantic landmarks
function App() {
  return (
    <>
      <header role="banner">
        <nav role="navigation" aria-label="Main navigation">
          {/* Navigation */}
        </nav>
      </header>
      
      <main role="main">
        <h1>Page Title</h1>
        {/* Content */}
      </main>
      
      <footer role="contentinfo">
        {/* Footer */}
      </footer>
    </>
  )
}
```

### Headings Hierarchy

```tsx
// Good: Logical heading order
<main>
  <h1>Austin & Jordyn's Wedding</h1>
  
  <section aria-labelledby="gallery-heading">
    <h2 id="gallery-heading">Photo Gallery</h2>
    
    <article>
      <h3>Ceremony</h3>
      {/* Photos */}
    </article>
    
    <article>
      <h3>Reception</h3>
      {/* Photos */}
    </article>
  </section>
</main>

// Bad: Skipping levels
<main>
  <h1>Title</h1>
  <h3>Subtitle</h3>  {/* ❌ Skipped h2 */}
</main>
```

## Images and Media

### Decorative Images

```tsx
// Purely decorative: empty alt
<img src="divider.svg" alt="" role="presentation" />
```

### Informative Images

```tsx
// Has meaning: descriptive alt
<img 
  src="venue.jpg" 
  alt="The Grand Ballroom at the Hyatt, featuring floor-to-ceiling windows overlooking the city"
/>
```

### Complex Images (Charts/Diagrams)

```tsx
<figure>
  <img src="seating-chart.png" alt="Wedding seating chart" />
  <figcaption>
    Table assignments: Table 1 - Family, Table 2 - Friends, etc.
  </figcaption>
</figure>
```

### Gallery Images

```tsx
// Photo with caption pattern
<figure>
  <img
    src={photo.url}
    alt={photo.altText || photo.caption || 'Wedding photo'}
    loading="lazy"
  />
  {photo.caption && (
    <figcaption>{photo.caption}</figcaption>
  )}
</figure>
```

### Videos

```tsx
<video controls>
  <source src="wedding-video.mp4" type="video/mp4" />
  <track 
    kind="captions" 
    src="wedding-captions.vtt" 
    srclang="en" 
    label="English" 
    default
  />
  Your browser does not support the video tag.
</video>
```

## Keyboard Navigation

### Focus Management

```tsx
// Visible focus indicators
<button className="focus:outline-none focus:ring-2 focus:ring-amber-500">
  Click me
</button>

// Skip link for keyboard users
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content" tabIndex={-1}>
  {/* Content */}
</main>
```

### Focus Trap (Modals)

```tsx
import { useEffect, useRef } from 'react'

function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus first focusable element
    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusable?.[0] as HTMLElement
    firstElement?.focus()

    // Trap focus
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      
      const focusableArray = Array.from(focusable || [])
      const first = focusableArray[0] as HTMLElement
      const last = focusableArray[focusableArray.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleTabKey)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('keydown', handleTabKey)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  )
}
```

### Keyboard Shortcuts

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Gallery navigation: Arrow keys
    if (e.key === 'ArrowRight') goToNext()
    if (e.key === 'ArrowLeft') goToPrevious()
    if (e.key === 'Escape') closeGallery()
    
    // Focus trap in modals
    // (handled in Modal component)
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

## ARIA Attributes

### Common Patterns

```tsx
// Button with loading state
<button 
  aria-busy={isLoading}
  aria-label={isLoading ? 'Submitting...' : 'Submit form'}
  disabled={isLoading}
>
  {isLoading ? <Spinner /> : 'Submit'}
</button>

// Expandable section
<button 
  aria-expanded={isOpen}
  aria-controls="menu-content"
  onClick={toggle}
>
  Menu
</button>
<div 
  id="menu-content"
  role="region"
  hidden={!isOpen}
>
  {/* Menu items */}
</div>

// Live region for announcements
<div role="status" aria-live="polite" className="sr-only">
  {announcement}
</div>

// Current page in navigation
<nav aria-label="Pagination">
  <a href="/page/1" aria-current="page">1</a>
  <a href="/page/2">2</a>
</nav>
```

### Form Labels

```tsx
// Explicit label
<label htmlFor="name">Your Name</label>
<input id="name" type="text" required />

// Implicit label
<label>
  Your Email
  <input type="email" required />
</label>

// Label with helper text
<label htmlFor="guests">
  Number of Guests
  <span className="text-gray-500">(including yourself)</span>
</label>
<input 
  id="guests" 
  type="number" 
  min="1" 
  max="4"
  aria-describedby="guests-hint"
/>
<p id="guests-hint" className="sr-only">
  Maximum 4 guests per invitation
</p>

// Error message
<input 
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'email-error' : undefined}
/>
{hasError && (
  <p id="email-error" role="alert" className="text-red-500">
    Please enter a valid email address
  </p>
)}
```

## Screen Reader Support

### Visually Hidden Content

```tsx
// sr-only utility class
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Usage
<button>
  <IconHeart className="w-5 h-5" />
  <span className="sr-only">Like photo</span>
</button>
```

### Descriptive Links

```tsx
// Bad: "Click here"
<a href="/venue">Click here</a> for venue details

// Good: Descriptive text
<a href="/venue">View venue details and directions</a>

// Better: Context in aria-label
<a href="/rsvp" aria-label="RSVP for Austin and Jordyn's wedding">
  RSVP
</a>
```

### Dynamic Content

```tsx
// Announce to screen readers
function useAnnouncement() {
  const [announcement, setAnnouncement] = useState('')

  const announce = (message: string) => {
    setAnnouncement(message)
    setTimeout(() => setAnnouncement(''), 1000)
  }

  return { announcement, announce }
}

// Usage
const { announcement, announce } = useAnnouncement()

// After photo upload
announce('Photo uploaded successfully. Processing...')

// Live region
<div role="status" aria-live="polite" className="sr-only">
  {announcement}
</div>
```

## Reduced Motion

```tsx
// Respect user's motion preferences
const prefersReducedMotion = 
  typeof window !== 'undefined' && 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Conditional animation
<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
>
  Content
</motion.div>

// CSS approach
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing Accessibility

### Automated Testing

```bash
# Run axe tests
npm run test:e2e -- tests/e2e/a11y.spec.ts

# Or with Playwright
npx playwright test e2e/a11y.spec.ts
```

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  
  expect(results.violations).toEqual([])
})
```

### Manual Testing Checklist

- [ ] Navigate with Tab key only
- [ ] Check focus indicators are visible
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Verify all images have alt text
- [ ] Check color contrast ratios
- [ ] Test zoom up to 200%
- [ ] Verify form labels are present
- [ ] Test with reduced motion preference

### Browser DevTools

```
Chrome:
- Lighthouse → Accessibility audit
- DevTools → Elements → Accessibility panel

Firefox:
- DevTools → Accessibility tab
```

## Common Issues & Fixes

### Missing Alt Text

```tsx
// ❌ Bad
<img src="photo.jpg" />

// ✅ Good
<img src="photo.jpg" alt="Bride and groom first dance" />

// ✅ Decorative
<img src="divider.svg" alt="" role="presentation" />
```

### Low Contrast

```tsx
// ❌ Bad
<p className="text-gray-400">Light gray on white</p>

// ✅ Good
<p className="text-gray-700">Darker gray on white</p>
```

### Missing Focus States

```tsx
// ❌ Bad
<button className="outline-none">Click</button>

// ✅ Good
<button className="outline-none focus:ring-2 focus:ring-amber-500">
  Click
</button>
```

### Empty Links/Buttons

```tsx
// ❌ Bad
<a href="/gallery"><IconGallery /></a>

// ✅ Good
<a href="/gallery">
  <IconGallery aria-hidden="true" />
  <span className="sr-only">View photo gallery</span>
</a>
```

## Accessibility Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
