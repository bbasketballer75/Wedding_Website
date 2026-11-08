import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement scrollIntoView; the skip link calls it on activation.
Element.prototype.scrollIntoView = () => undefined

afterEach(() => {
  cleanup()
})
