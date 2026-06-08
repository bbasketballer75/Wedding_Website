import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Guestbook from './Guestbook'
import { supabase } from '@/lib/supabase'

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
}))

vi.mock('@/components/seo/SEOHead', () => ({
  GuestbookSEO: () => null,
}))

describe('Guestbook Honeypot Spam Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders honeypot field and allows normal submission', async () => {
    render(<Guestbook />)

    // Open form
    const signButton = screen.getByText('Start your message')
    fireEvent.click(signButton)

    // Verify honeypot exists
    const honeypotInput = screen.getByLabelText('Leave this blank')
    expect(honeypotInput).toBeInTheDocument()

    // Fill form
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest User' } })
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Beautiful wedding!' },
    })

    // Submit form (website/honeypot is left blank)
    const submitButton = screen.getByText('Post to the guestbook')
    fireEvent.click(submitButton)

    // Verify RPC or insert is called
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        'submit_guestbook_message_with_rate_limit',
        expect.objectContaining({
          p_name: 'Guest User',
          p_content: 'Beautiful wedding!',
        })
      )
    })
  })

  it('silently blocks submission if the honeypot field is filled', async () => {
    render(<Guestbook />)

    // Open form
    const signButton = screen.getByText('Start your message')
    fireEvent.click(signButton)

    // Fill form
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Spam Bot' } })
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Buy cheap things!' },
    })

    // Fill honeypot field
    const honeypotInput = screen.getByLabelText('Leave this blank')
    fireEvent.change(honeypotInput, { target: { value: 'http://spam.url' } })

    // Clear mocks before submit to only record calls from submit
    vi.clearAllMocks()

    // Submit form
    const submitButton = screen.getByText('Post to the guestbook')
    fireEvent.click(submitButton)

    // Verify that Supabase is NOT called (silently blocked)
    await waitFor(() => {
      expect(supabase.rpc).not.toHaveBeenCalled()
      expect(supabase.from).not.toHaveBeenCalled()
    })
  })
})
