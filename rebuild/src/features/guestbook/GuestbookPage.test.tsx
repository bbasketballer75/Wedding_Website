import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GuestbookPage } from './GuestbookPage'
import { createStubGuestbookApi, GUESTBOOK_FIXED_NOW, GUESTBOOK_FIXTURE } from './data'
import type { GuestbookApi, GuestbookMessage } from './types'

function createApi(overrides: Partial<GuestbookApi> = {}): GuestbookApi {
  return { ...createStubGuestbookApi(), ...overrides }
}

function makeMessages(count: number): GuestbookMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `note-${index + 1}`,
    name: `Guest ${index + 1}`,
    content: `Memory number ${index + 1} from the wedding celebration.`,
    createdAt: `2025-05-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    mediaUrl: null,
    reactions: {},
    comments: [],
  }))
}

function manualScheduler() {
  const tasks: Array<{ callback: () => void; delayMs: number }> = []
  return {
    schedule: (callback: () => void, delayMs: number) => {
      tasks.push({ callback, delayMs })
      return tasks.length
    },
    runNext: () => {
      tasks.shift()?.callback()
    },
    runAll: () => {
      while (tasks.length > 0) tasks.shift()?.callback()
    },
  }
}

async function renderLoadedPage(props: Parameters<typeof GuestbookPage>[0] = {}) {
  render(<GuestbookPage {...props} />)
  await screen.findByText('Sarah Mitchell')
}

describe('GuestbookPage', () => {
  it('renders the frozen copy, hero count, feed count and fixture notes', async () => {
    await renderLoadedPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Say something before you go.' })
    ).toBeInTheDocument()
    expect(screen.getByText('After the film')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The guestbook is where the day settles. Whatever you felt, what you remember, or what you want us to carry forward — leave it here.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start your message' })).toBeInTheDocument()
    expect(screen.getByText('3 notes so far')).toBeInTheDocument()
    expect(screen.getByText('Every guestbook entry')).toBeInTheDocument()
    expect(screen.getByText('3 notes')).toBeInTheDocument()

    expect(screen.getByText('Sarah Mitchell')).toBeInTheDocument()
    expect(screen.getByText('Mike Chen')).toBeInTheDocument()
    expect(screen.getByText('Aunt Patricia')).toBeInTheDocument()
    expect(screen.getByText('May 12, 2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Love reaction, 12 votes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply (1)' })).toBeInTheDocument()
    // Unknown reaction keys from the DB render with their stored label/emoji.
    expect(screen.getByRole('button', { name: 'fire reaction, 8 votes' })).toBeInTheDocument()
    // The fixture set is smaller than a page, so no "Read more notes" control.
    expect(screen.queryByRole('button', { name: 'Read more notes' })).toBeNull()
  })

  it('paginates the feed with "Read more notes" (8 at a time)', async () => {
    const user = userEvent.setup()
    const api = createApi({ loadMessages: vi.fn(() => Promise.resolve(makeMessages(12))) })
    render(<GuestbookPage api={api} />)

    await screen.findByText('Guest 1')
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Read more notes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Read more notes' }))
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(12)
    expect(screen.queryByRole('button', { name: 'Read more notes' })).toBeNull()
  })

  it('searches by name and message content and shows the no-results state', async () => {
    const user = userEvent.setup()
    await renderLoadedPage()

    const search = screen.getByLabelText('Search guestbook messages')
    await user.type(search, 'Mike')
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(1)
    expect(screen.getByText('Mike Chen')).toBeInTheDocument()
    expect(screen.queryByText('Sarah Mitchell')).toBeNull()

    await user.clear(search)
    await user.type(search, 'dance floor')
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(1)

    await user.clear(search)
    await user.type(search, 'no-such-note')
    expect(screen.getByText(/No notes matching/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave the first note' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByLabelText('Search guestbook messages')).toHaveValue('')
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(3)
  })

  it('opens the composer, validates, submits, prepends optimistically and manages focus', async () => {
    const user = userEvent.setup()
    const scheduler = manualScheduler()
    const submitMessage = vi.fn(() =>
      Promise.resolve({
        status: 'submitted' as const,
        messageId: 'saved-note',
        rateLimitRemaining: null,
        viaFallback: false,
      })
    )
    const api = createApi({ submitMessage })
    render(
      <GuestbookPage
        api={api}
        schedule={scheduler.schedule}
        now={() => new Date(GUESTBOOK_FIXED_NOW).getTime()}
      />
    )
    await screen.findByText('Sarah Mitchell')

    await user.click(screen.getByRole('button', { name: 'Start your message' }))
    const composer = screen.getByTestId('guestbook-composer')
    expect(composer).toBeInTheDocument()
    expect(within(composer).getByLabelText(/Your name/)).toBeInTheDocument()
    expect(within(composer).getByLabelText(/Email/)).toBeInTheDocument()
    expect(within(composer).getByLabelText('Your message')).toBeInTheDocument()

    // Submit is disabled until name + content exist.
    expect(screen.getByRole('button', { name: 'Post to the guestbook' })).toBeDisabled()

    const nameInput = within(composer).getByLabelText(/Your name/)
    const messageInput = within(composer).getByLabelText('Your message')
    await user.type(nameInput, 'A')
    await user.type(messageInput, 'A beautiful, memorable day for everyone.')
    await user.click(screen.getByRole('button', { name: 'Post to the guestbook' }))
    expect(await screen.findByText(/between 2 and 50/)).toBeInTheDocument()
    expect(submitMessage).not.toHaveBeenCalled()

    await user.clear(nameInput)
    await user.type(nameInput, 'Austin')
    await user.click(screen.getByRole('button', { name: 'Post to the guestbook' }))

    expect(await screen.findByText('Your note is part of the book now.')).toHaveFocus()
    expect(submitMessage).toHaveBeenCalledWith({
      name: 'Austin',
      email: '',
      content: 'A beautiful, memorable day for everyone.',
    })
    // Optimistic prepend: the new note appears in the feed immediately.
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(4)
    expect(composer).toHaveAttribute('data-submit-fallback', 'false')

    // Frozen 2200 ms reset is scheduled (not slept): run it and the composer closes.
    await waitFor(() => expect(scheduler.schedule).toBeTruthy())
    scheduler.runAll()
    await waitFor(() => expect(screen.queryByTestId('guestbook-composer')).toBeNull())
  })

  it('silently succeeds on a filled honeypot without calling the submit API', async () => {
    const user = userEvent.setup()
    const scheduler = manualScheduler()
    const submitMessage = vi.fn()
    const api = createApi({ submitMessage })
    render(<GuestbookPage api={api} schedule={scheduler.schedule} />)
    await screen.findByText('Sarah Mitchell')

    await user.click(screen.getByRole('button', { name: 'Start your message' }))
    const composer = screen.getByTestId('guestbook-composer')
    await user.type(within(composer).getByLabelText(/Your name/), 'Bot McBotface')
    await user.type(within(composer).getByLabelText('Your message'), 'Buy my amazing products now.')
    const honeypot = document.querySelector<HTMLInputElement>('#website')
    expect(honeypot).not.toBeNull()
    if (honeypot) fireEvent.change(honeypot, { target: { value: 'https://spam.example' } })
    await user.click(screen.getByRole('button', { name: 'Post to the guestbook' }))

    expect(submitMessage).not.toHaveBeenCalled()
    // Run the scheduled honeypot "success" (500 ms) then its visible reset (2200 ms).
    act(() => scheduler.runNext())
    expect(await screen.findByText('Your note is part of the book now.')).toBeInTheDocument()
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(3)
    act(() => scheduler.runAll())
  })

  it('adds a reaction through the picker and shows the optimistic count', async () => {
    const user = userEvent.setup()
    await renderLoadedPage()

    const firstCard = screen.getAllByTestId('guestbook-message')[0]
    expect(firstCard).toBeDefined()
    if (!firstCard) throw new Error('missing message card')
    await user.click(within(firstCard).getByRole('button', { name: 'Add a reaction' }))
    const picker = screen.getByRole('dialog', { name: 'Choose a reaction' })
    expect(picker).toBeInTheDocument()
    await user.click(within(picker).getByRole('button', { name: 'Clap' }))

    expect(screen.queryByRole('dialog', { name: 'Choose a reaction' })).toBeNull()
    expect(
      await screen.findByRole('button', { name: 'Clap reaction, 5 votes' })
    ).toBeInTheDocument()
    expect(within(firstCard).getByText('You reacted')).toBeInTheDocument()
  })

  it('appends a reply optimistically through the message card', async () => {
    const user = userEvent.setup()
    const addReply = vi.fn(() =>
      Promise.resolve({
        id: 'saved-reply-1',
        author: 'Guest',
        content: 'So happy for you both!',
        createdAt: GUESTBOOK_FIXED_NOW,
      })
    )
    const api = createApi({ addReply })
    render(<GuestbookPage api={api} />)
    await screen.findByText('Sarah Mitchell')

    const firstCard = screen.getAllByTestId('guestbook-message')[0]
    if (!firstCard) throw new Error('missing message card')
    await user.click(within(firstCard).getByRole('button', { name: 'Reply (1)' }))
    const replyBox = within(firstCard).getByLabelText('Add a reply')
    await user.type(replyBox, 'So happy for you both!')
    await user.click(within(firstCard).getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('So happy for you both!')).toBeInTheDocument()
    expect(addReply).toHaveBeenCalledWith({
      messageId: 'message-1',
      author: 'Guest',
      content: 'So happy for you both!',
    })
    expect(within(firstCard).getByRole('button', { name: 'Reply (2)' })).toBeInTheDocument()
  })

  it('handles the ?message= deep link: expands, highlights, scrolls and clears a conflicting ?q=', async () => {
    const scrollToMessage = vi.fn()
    const api = createApi({ loadMessages: vi.fn(() => Promise.resolve(makeMessages(12))) })
    render(
      <GuestbookPage
        api={api}
        search={{ message: 'note-11', q: 'Guest 4' }}
        scrollToMessage={scrollToMessage}
      />
    )

    await screen.findByText('Guest 1')
    // The conflicting search is cleared at initialisation so the note is visible.
    expect(screen.getByLabelText('Search guestbook messages')).toHaveValue('')
    // The deep-linked note is inside the expanded page and highlighted.
    expect(screen.getAllByTestId('guestbook-message')).toHaveLength(11)
    const linkedCard = document.getElementById('guestbook-message-note-11')
    expect(linkedCard).not.toBeNull()
    expect(linkedCard?.className).toMatch(/ring-2/)
    expect(scrollToMessage).toHaveBeenCalledWith('note-11')
  })

  it('renders the empty state when there are no notes', async () => {
    const api = createApi({ loadMessages: vi.fn(() => Promise.resolve([])) })
    render(<GuestbookPage api={api} />)

    expect(await screen.findByText('No notes yet — yours could be the first.')).toBeInTheDocument()
    expect(
      screen.getByText("Leave something small. It doesn't need to be a speech.")
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave the first note' })).toBeInTheDocument()
    expect(screen.queryByText('notes so far')).toBeNull()
  })

  it('surfaces a load error but keeps the page usable', async () => {
    const api = createApi({
      loadMessages: vi.fn(() => Promise.reject(new Error('network down'))),
    })
    render(<GuestbookPage api={api} />)

    expect(
      await screen.findByText(
        'Having trouble loading notes right now — yours will still go through below.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start your message' })).toBeInTheDocument()
  })

  it('exposes the accessibility contract: labelled controls, live regions, keyboard reactions', async () => {
    await renderLoadedPage()

    expect(screen.getByLabelText('Search guestbook messages')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Love reaction, 12 votes' })).toBeInTheDocument()
    const firstCard = screen.getAllByTestId('guestbook-message')[0]
    if (!firstCard) throw new Error('missing message card')
    expect(within(firstCard).getByRole('button', { name: 'Add a reaction' })).toBeInTheDocument()
    expect(within(firstCard).getByRole('button', { name: 'Reply (1)' })).toBeInTheDocument()

    // Composer adds labelled fields, an aria-live status and focusable success heading.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start your message' }))
    const composer = screen.getByTestId('guestbook-composer')
    expect(within(composer).getByLabelText(/Your name/)).toBeInTheDocument()
    expect(within(composer).getByLabelText('Your message')).toBeInTheDocument()
    expect(within(composer).getByRole('button', { name: 'Close composer' })).toBeInTheDocument()
    expect(document.querySelectorAll('[role="status"]').length).toBeGreaterThan(0)
    expect(GUESTBOOK_FIXTURE).toHaveLength(3)
  })
})
