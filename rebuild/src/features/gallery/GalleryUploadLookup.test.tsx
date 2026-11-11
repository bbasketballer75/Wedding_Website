import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GalleryUploadLookup } from './GalleryUploadLookup'
import { UPLOAD_STATUS_FIXTURE } from './fixtures'
import type { GuestUploadStatus } from './data'

describe('GalleryUploadLookup', () => {
  it('renders the frozen copy with a labelled email field', () => {
    render(<GalleryUploadLookup />)

    expect(screen.getByRole('heading', { name: 'Check Your Upload Status' })).toBeInTheDocument()
    expect(
      screen.getByText('Enter the email address you used when uploading to see your status.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email address used for your upload')).toHaveAttribute(
      'type',
      'email'
    )
    expect(screen.getByRole('button', { name: 'Look up' })).toBeInTheDocument()
  })

  it('validates the email before calling the lookup', async () => {
    const user = userEvent.setup()
    const lookupStatus = vi.fn<(email: string) => Promise<GuestUploadStatus>>()
    render(<GalleryUploadLookup lookupStatus={lookupStatus} />)

    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter the email address you used when uploading.'
    )

    await user.type(screen.getByLabelText('Email address used for your upload'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(lookupStatus).not.toHaveBeenCalled()
  })

  it('shows the approved upload status result for a valid email', async () => {
    const user = userEvent.setup()
    const lookupStatus = vi.fn(() => Promise.resolve({ ...UPLOAD_STATUS_FIXTURE }))
    render(<GalleryUploadLookup lookupStatus={lookupStatus} />)

    await user.type(
      screen.getByLabelText('Email address used for your upload'),
      '  jamie@example.com '
    )
    await user.click(screen.getByRole('button', { name: 'Look up' }))

    expect(lookupStatus).toHaveBeenCalledWith('jamie@example.com')
    expect(await screen.findByText('Jamie Rivera')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('surfaces lookup failures inline', async () => {
    const user = userEvent.setup()
    const lookupStatus = vi.fn(() =>
      Promise.reject(new Error('Unable to look up status right now. Please try again.'))
    )
    render(<GalleryUploadLookup lookupStatus={lookupStatus} />)

    await user.type(
      screen.getByLabelText('Email address used for your upload'),
      'jamie@example.com'
    )
    await user.click(screen.getByRole('button', { name: 'Look up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to look up status right now. Please try again.'
    )
  })
})
