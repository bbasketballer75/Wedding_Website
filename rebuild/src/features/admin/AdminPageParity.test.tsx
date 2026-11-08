import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import adminRendered from '../../../../contracts/content/rendered/admin.json'
import adminLoginRendered from '../../../../contracts/content/rendered/admin-login.json'
import { installAdminTestEnvironment } from './test-utils/adminTestEnvironment'
import { createTestAdminRuntime } from './test-utils/createTestAdminRuntime'
import { renderAdminRoute } from './test-utils/renderAdmin'

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Case-insensitive only because the oracle captured browser `innerText` (CSS
 * `text-transform: uppercase` applied) while jsdom exposes source case. The
 * browser parity harness compares the real innerText bytes.
 */
function comparable(value: string): string {
  return normalize(value).toLowerCase()
}

function isNumericLine(line: string): boolean {
  return /^\d+$/.test(normalize(line))
}

describe('Admin shell parity against the frozen rendered oracle', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches the dashboard headings exactly', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin' })
    await screen.findByTestId('admin-content')

    const headings = [...container.querySelectorAll('h1, h2')].map(heading => ({
      level: Number(heading.tagName.slice(1)),
      text: normalize(heading.textContent ?? ''),
    }))

    expect(headings).toEqual(adminRendered.snapshots.desktop.headings)
  })

  it('renders every static dashboard line from the oracle', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin' })
    await screen.findByTestId('admin-content')

    const visibleText = comparable(container.textContent ?? '')
    // Counts/queue copy depend on the injected API fixture (the frozen capture
    // used zeroed e2e mocks); every non-numeric static line must be present.
    const dynamicLineIndexes = new Set(['37', '38', '45', '49', '53', '55'])
    const expectedLines = adminRendered.snapshots.desktop.mainText.filter(
      (line, index) => !isNumericLine(line) && !dynamicLineIndexes.has(String(index))
    )

    expect(expectedLines.length).toBeGreaterThan(40)
    expect(expectedLines.filter(line => !visibleText.includes(comparable(line)))).toEqual([])
    expect(adminRendered.snapshots.desktop.images).toEqual([])
  })
})

describe('Admin login parity against the frozen rendered oracle', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches the login headings, copy and empty image list exactly', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/login' })
    await screen.findByRole('heading', { level: 1, name: 'Admin sign in' })

    const headings = [...container.querySelectorAll('h1, h2')].map(heading => ({
      level: Number(heading.tagName.slice(1)),
      text: normalize(heading.textContent ?? ''),
    }))
    expect(headings).toEqual(adminLoginRendered.snapshots.desktop.headings)
    expect(adminLoginRendered.snapshots.desktop.images).toEqual([])

    const visibleText = comparable(container.textContent ?? '')
    const missing = adminLoginRendered.snapshots.desktop.mainText.filter(
      line => !visibleText.includes(comparable(line))
    )
    expect(missing).toEqual([])
  })
})
