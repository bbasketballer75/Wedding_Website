import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from './test-utils/adminTestEnvironment'
import { createTestAdminRuntime } from './test-utils/createTestAdminRuntime'
import { renderAdminRoute } from './test-utils/renderAdmin'

function AdminStandIn({ label }: { label: string }) {
  return <div data-testid='w7-2-stand-in'>{label}</div>
}

describe('AdminApp routing', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('routes to the W7-1 pages for the Lead-wired splat paths', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })

    for (const [path, heading] of [
      ['/admin', 'A faster weekly view of what needs attention.'],
      ['/admin/photos', 'Guest Upload Moderation'],
      ['/admin/claims', 'Pending Claims'],
      ['/admin/guestbook', 'Guestbook Moderation'],
      ['/admin/audit', 'Moderation Audit Trail'],
    ] as const) {
      const rendered = await renderAdminRoute({ runtime, initialPath: path })
      if (path === '/admin/claims') {
        expect(await screen.findByText('Pending Claims')).toBeInTheDocument()
      } else {
        expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
      }
      rendered.unmount()
    }
  })

  it('renders the W7-2 seam placeholder for not-yet-ported sections', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/albums' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'The albums workspace lands in W7-2.' })
    ).toBeInTheDocument()
  })

  it('accepts injected W7-2 pages through the page registry', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({
      runtime,
      initialPath: '/admin/featured',
      pages: {
        featured: () => <AdminStandIn label='Featured content manager (W7-2)' />,
      },
    })

    expect(await screen.findByTestId('w7-2-stand-in')).toHaveTextContent(
      'Featured content manager (W7-2)'
    )
  })

  it('approves the W7-2 analytics/settings routes through the placeholder seam', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })

    for (const section of ['review', 'analytics', 'settings'] as const) {
      const rendered = await renderAdminRoute({ runtime, initialPath: `/admin/${section}` })
      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: `The ${section} workspace lands in W7-2.`,
        })
      ).toBeInTheDocument()
      rendered.unmount()
    }
  })
})
