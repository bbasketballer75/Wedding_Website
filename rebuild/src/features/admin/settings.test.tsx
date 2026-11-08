import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './settings'

/**
 * Settings tests: the page is read-only operations copy, renders the live env
 * values, and keeps the "no in-app export/backup" statement.
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('SettingsPage', () => {
  it('renders the frozen operations notes and read-only contract', () => {
    vi.stubEnv('VITE_SITE_URL', 'https://www.theporadas.com')
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://media.wedding.theporadas.com')

    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Operations Notes' })).toBeInTheDocument()
    expect(screen.getByText(/This screen is intentionally read-only/i)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Live Site Configuration' })).toBeInTheDocument()
    expect(screen.getByText('https://www.theporadas.com')).toBeInTheDocument()
    expect(screen.getByText('https://media.wedding.theporadas.com')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Moderation Defaults' })).toBeInTheDocument()
    expect(screen.getByText('Guest uploads are live and require approval.')).toBeInTheDocument()
    expect(screen.getByText('Guestbook stays open and self-service.')).toBeInTheDocument()
    expect(screen.getByText('Traffic analytics live outside the admin UI.')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Export and Backup Guidance' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /There is no in-app export button anymore because it was placeholder behavior/i
      )
    ).toBeInTheDocument()
  })

  it('falls back to the documented default site origin when env is absent', () => {
    vi.stubEnv('VITE_SITE_URL', '')
    vi.stubEnv('VITE_MEDIA_BASE_URL', '')
    render(<SettingsPage />)

    expect(screen.getByText('https://www.theporadas.com')).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
  })
})
