import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UploadPage } from './UploadPage'
import { UPLOAD_ERRORS, UploadFailure } from './uploadErrors'
import { createStubUploadApi } from './data'
import type { UploadApi, UploadStorage } from './types'

function memoryStorage(): UploadStorage {
  const store = new Map<string, string>()
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: key => {
      store.delete(key)
    },
  }
}

function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  const file = new File(['data'], name, { type, lastModified: 123 })
  Object.defineProperty(file, 'size', { value: 2048 })
  return file
}

function makeApi(overrides: Partial<UploadApi> = {}): UploadApi {
  return { ...createStubUploadApi(), ...overrides }
}

function manualScheduler() {
  const tasks: Array<{ callback: () => void; delayMs: number }> = []
  return {
    schedule: (callback: () => void, delayMs: number) => {
      tasks.push({ callback, delayMs })
      return tasks.length
    },
    runAll: () => {
      while (tasks.length > 0) tasks.shift()?.callback()
    },
  }
}

function renderPage(props: Partial<Parameters<typeof UploadPage>[0]> = {}) {
  const schedule = manualScheduler()
  return render(
    <UploadPage
      api={makeApi()}
      storage={memoryStorage()}
      putFile={() => Promise.resolve('https://media.test/photo.jpg')}
      createPreview={() => undefined}
      compressImage={file => Promise.resolve(file)}
      fingerprintFile={() => Promise.resolve('sha256:fixture')}
      sleep={() => Promise.resolve()}
      clipboard={{ writeText: vi.fn(() => Promise.resolve()) }}
      schedule={schedule.schedule}
      siteShareUrl='https://www.theporadas.com'
      shareOrigin='https://www.theporadas.com'
      {...props}
    />
  )
}

async function addPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Select photos or videos to upload')
  await user.upload(input, makeFile())
  await waitFor(() => expect(screen.getByText('1 of 1 files ready to send')).toBeInTheDocument())
}

describe('UploadPage', () => {
  it('renders the frozen upload copy, dropzone, details column and share section', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Preserve the moments from your perspective.' })
    ).toBeInTheDocument()
    expect(screen.getByText('Contribute to the Archive')).toBeInTheDocument()
    expect(screen.getByText('Photos welcome')).toBeInTheDocument()
    expect(screen.getByText('Videos welcome')).toBeInTheDocument()
    expect(screen.getByText('Reviewed before posting')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Already uploaded memories?' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Claim My Photos/ })).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Drop photos or videos to begin.' })
    ).toBeInTheDocument()
    expect(screen.getByText('Click anywhere or drag your files in')).toBeInTheDocument()
    expect(screen.getByText('Up to 50 files, 500MB each')).toBeInTheDocument()
    expect(screen.getByLabelText('Select photos or videos to upload')).toHaveAttribute(
      'accept',
      'image/*,video/*'
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Tell us who this upload came from.' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Add a Note (Optional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose your files first' })).toBeDisabled()

    expect(screen.getByText('Pass the site along')).toBeInTheDocument()
    expect(screen.getByText('https://www.theporadas.com')).toBeInTheDocument()

    // Queue panel only appears once files exist.
    expect(screen.queryByTestId('upload-queue-panel')).toBeNull()
  })

  it('adds a file through the picker, shows progress and gates submit on name + email', async () => {
    const user = userEvent.setup()
    renderPage()

    await addPhoto(user)

    expect(screen.getByText('1 selected photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit 1 photo' })).toBeDisabled()

    await user.type(screen.getByLabelText('Your Name'), 'Jamie Rivera')
    expect(screen.getByRole('button', { name: 'Submit 1 photo' })).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'jamie@example.com')
    expect(screen.getByRole('button', { name: 'Submit 1 photo' })).toBeEnabled()
  })

  it('submits, shows the success panel with the share token, focuses the heading and copies the album link', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    const api = makeApi({ getOrCreateShareToken: vi.fn(() => Promise.resolve('abc123')) })
    renderPage({ api, clipboard: { writeText } })

    await addPhoto(user)
    await user.type(screen.getByLabelText('Your Name'), 'Jamie Rivera')
    await user.type(screen.getByLabelText('Email'), 'jamie@example.com')
    await user.click(screen.getByRole('button', { name: 'Submit 1 photo' }))

    await waitFor(() => expect(screen.getByTestId('upload-success-panel')).toBeInTheDocument())
    expect(
      screen.getByRole('heading', { level: 1, name: 'Thank you for adding to the archive.' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('upload-success-heading')).toHaveFocus()
    expect(screen.getByText(/Your 1 photo is uploaded and pending review/)).toBeInTheDocument()
    expect(screen.getByTestId('upload-share-token-panel')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View My Album' })).toHaveAttribute(
      'href',
      '/guest/abc123'
    )

    await user.click(screen.getByRole('button', { name: /Copy Album Link/ }))
    expect(writeText).toHaveBeenCalledWith('https://www.theporadas.com/guest/abc123')
    expect(screen.getByRole('button', { name: /Copied!/ })).toBeInTheDocument()
  })

  it('keeps failed uploads in the queue with their distinct error and retries them', async () => {
    const user = userEvent.setup()
    let attempt = 0
    renderPage({
      putFile: () => {
        attempt += 1
        if (attempt === 1)
          return Promise.reject(new UploadFailure(UPLOAD_ERRORS.UPLOAD_SLOT_UNAVAILABLE))
        return Promise.resolve('https://media.test/photo.jpg')
      },
    })

    await user.upload(screen.getByLabelText('Select photos or videos to upload'), makeFile())

    expect(
      await screen.findByText('Upload slot unavailable — try again in a moment')
    ).toBeInTheDocument()
    expect(
      screen.getByText("These didn't upload — retry or remove them before sending")
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('1 of 1 files ready to send')).toBeInTheDocument())
  })

  it('removes a queued file and hides the queue when empty', async () => {
    const user = userEvent.setup()
    // Keep the upload in flight so the remove control is available (it hides for
    // completed files, matching the frozen queue panel).
    renderPage({ putFile: () => new Promise<string>(() => undefined) })

    await user.upload(screen.getByLabelText('Select photos or videos to upload'), makeFile())
    const removeButton = await screen.findByRole('button', { name: 'Remove photo.jpg' })
    await user.click(removeButton)
    await waitFor(() => expect(screen.queryByTestId('upload-queue-panel')).toBeNull())
    expect(screen.getByRole('button', { name: 'Choose your files first' })).toBeDisabled()
  })

  it('calls the injected claims entry point', async () => {
    const user = userEvent.setup()
    const onClaim = vi.fn()
    renderPage({ onClaim })
    await user.click(screen.getByRole('button', { name: /Claim My Photos/ }))
    expect(onClaim).toHaveBeenCalledOnce()
  })

  it('copies the site share link from the share section', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    renderPage({ clipboard: { writeText } })

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith('https://www.theporadas.com')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('exposes a fully labelled, screen-reader friendly form', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByLabelText('Select photos or videos to upload')).toBeInTheDocument()
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Add a Note (Optional)')).toBeInTheDocument()

    await addPhoto(user)
    expect(
      within(screen.getByTestId('upload-queue-panel')).getByText(/files ready to send/)
    ).toBeInTheDocument()
  })
})
