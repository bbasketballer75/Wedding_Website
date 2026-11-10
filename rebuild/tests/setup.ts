import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement scrollIntoView; the skip link calls it on activation.
Element.prototype.scrollIntoView = () => undefined

// The shell gates the footer on real content height (CLS fix); jsdom reports 0, so
// tests would never mount it. Give layout-less DOM a non-zero content height.
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get: () => 1000,
})

afterEach(() => {
  cleanup()
})
