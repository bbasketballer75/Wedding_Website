import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AlbumOrganizerSaveRequest } from './album-organizer-data'
import { ALBUM_ORGANIZER_FIXTURES } from './album-organizer-data'
import { AlbumOrganizerPage } from './AlbumOrganizerPage'

/**
 * Album organizer tests: keyboard reorder + dirty-diff save shape, pointer
 * drag, bulk moves, delete/undo, unsaved guard, search disabling reorder and
 * lazy per-album loading. All data comes from the deterministic fixture seam.
 */

function createData() {
  const saveAlbumOrganization = vi.fn((request: AlbumOrganizerSaveRequest) =>
    Promise.resolve({
      savedAlbum: request.album,
      movedCount: request.moves.length,
      deletedCount: request.deletes.length,
    })
  )
  return {
    saveAlbumOrganization,
    fetchAlbumPhotos: vi.fn(ALBUM_ORGANIZER_FIXTURES.fetchAlbumPhotos),
    fetchAlbumCounts: vi.fn(ALBUM_ORGANIZER_FIXTURES.fetchAlbumCounts),
  }
}

async function renderOrganizer() {
  const data = createData()
  const view = render(<AlbumOrganizerPage data={data} />)
  await screen.findByText('Ring details on the moss')
  return { ...view, ...data }
}

function cardOrder(): string[] {
  return screen.getAllByTestId(/^organizer-photo-/).map(element => {
    const testId = element.getAttribute('data-testid') ?? ''
    return testId.replace('organizer-photo-', '')
  })
}

function clickSave(): void {
  fireEvent.click(screen.getByRole('button', { name: /Save live order/i }))
}

describe('AlbumOrganizerPage', () => {
  it('renders the frozen organizer shell, album tabs and first-album photos', async () => {
    const data = await renderOrganizer()

    expect(screen.getByText('Album organizer')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Arrange the live gallery albums.' })
    ).toBeInTheDocument()
    expect(screen.getByText('No organizer changes saved yet.')).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ])
    expect(tabs[0]).toHaveTextContent('Engagement')
    expect(tabs[2]).toHaveTextContent('Wedding Day')

    expect(cardOrder()).toEqual(['eng-1', 'eng-2', 'eng-3'])
    expect(screen.getByText('reorder 0')).toBeInTheDocument()
    expect(screen.getByText('moves 0')).toBeInTheDocument()
    expect(screen.getByText('deletes 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save live order/i })).toBeDisabled()

    // Counts come from the seam: 3 Engagement, 2 Bach+ette, 4 Wedding Day, 0 guests.
    expect(data.fetchAlbumPhotos).toHaveBeenCalledWith('Engagement')
    expect(within(tabs[0] as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(tabs[1] as HTMLElement).getByText('2')).toBeInTheDocument()
    expect(within(tabs[2] as HTMLElement).getByText('4')).toBeInTheDocument()
  })

  it('reorders with the keyboard buttons and saves exactly the dirty diff', async () => {
    const data = await renderOrganizer()

    // Move the second photo one position earlier: the keyboard path, not drag.
    fireEvent.click(screen.getByRole('button', { name: /Move Walking the orchard path earlier/i }))

    expect(cardOrder()).toEqual(['eng-2', 'eng-1', 'eng-3'])
    expect(screen.getByText('reorder 2')).toBeInTheDocument()
    expect(screen.getByText('unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save live order/i })).toBeEnabled()

    clickSave()

    await waitFor(() => expect(data.saveAlbumOrganization).toHaveBeenCalledTimes(1))
    expect(data.saveAlbumOrganization).toHaveBeenCalledWith({
      album: 'Engagement',
      order: ['eng-2', 'eng-1', 'eng-3'],
      moves: [],
      deletes: [],
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save live order/i })).toBeDisabled()
    )
    expect(screen.getByText(/^Saved Engagement on /)).toBeInTheDocument()
    expect(data.fetchAlbumCounts).toHaveBeenCalled()
  })

  it('supports the pointer drag path without a drag library', async () => {
    await renderOrganizer()

    const first = screen.getByTestId('organizer-photo-eng-1')
    const last = screen.getByTestId('organizer-photo-eng-3')

    fireEvent.dragStart(first)
    fireEvent.dragOver(last)
    fireEvent.drop(last)

    expect(cardOrder()).toEqual(['eng-2', 'eng-3', 'eng-1'])
  })

  it('bulk moves selected photos between albums with the frozen payload shape', async () => {
    const data = await renderOrganizer()

    fireEvent.click(screen.getByRole('button', { name: /Select Ring details on the moss/i }))
    fireEvent.click(screen.getByRole('button', { name: /Select Walking the orchard path/i }))
    expect(screen.getByText('2 photos selected')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Bulk move selected photos to album'), {
      target: { value: 'Wedding Day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move selected' }))

    expect(screen.getByText(/2 photos will move when you save/)).toBeInTheDocument()
    expect(cardOrder()).toEqual(['eng-3'])

    clickSave()
    await waitFor(() => expect(data.saveAlbumOrganization).toHaveBeenCalledTimes(1))
    expect(data.saveAlbumOrganization).toHaveBeenCalledWith({
      album: 'Engagement',
      order: ['eng-3'],
      moves: [
        { photoId: 'eng-1', targetAlbum: 'Wedding Day' },
        { photoId: 'eng-2', targetAlbum: 'Wedding Day' },
      ],
      deletes: [],
    })
  })

  it('moves a selection to the top/bottom and places it after an anchor', async () => {
    await renderOrganizer()

    fireEvent.click(screen.getByRole('button', { name: /Select Ring details on the moss/i }))
    fireEvent.click(screen.getByRole('button', { name: /Move to bottom/i }))
    expect(cardOrder()).toEqual(['eng-2', 'eng-3', 'eng-1'])

    fireEvent.click(screen.getByRole('button', { name: /Move to top/i }))
    expect(cardOrder()).toEqual(['eng-1', 'eng-2', 'eng-3'])

    // Place the selection after eng-3 (last anchor): order becomes eng-2, eng-3, eng-1.
    fireEvent.change(screen.getByLabelText('Place selected photos after another photo'), {
      target: { value: 'eng-3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Place after selected photo/i }))
    expect(cardOrder()).toEqual(['eng-2', 'eng-3', 'eng-1'])
  })

  it('stages a deletion, allows undo and saves only the delete when confirmed', async () => {
    const data = await renderOrganizer()

    fireEvent.click(
      screen.getByRole('button', { name: /Stage Walking the orchard path for deletion/i })
    )

    expect(cardOrder()).toEqual(['eng-1', 'eng-3'])
    expect(screen.getByText(/1 photo will be removed from the live gallery/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save live order/i })).toBeEnabled()

    // Undo restores the row; the frozen hook appends it at the end of the draft.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(cardOrder()).toEqual(['eng-1', 'eng-3', 'eng-2'])
    expect(screen.getByText('deletes 0')).toBeInTheDocument()
    expect(screen.queryByText(/will be removed from the live gallery/)).toBeNull()

    // The restored row sits at the end, so the draft is still dirty until Reset;
    // Reset restores the saved order so the next save is a pure delete diff.
    fireEvent.click(screen.getByRole('button', { name: /^Reset$/i }))
    expect(cardOrder()).toEqual(['eng-1', 'eng-2', 'eng-3'])
    expect(screen.getByRole('button', { name: /Save live order/i })).toBeDisabled()

    // Delete again and save: the payload carries only the id.
    fireEvent.click(
      screen.getByRole('button', { name: /Stage Walking the orchard path for deletion/i })
    )
    clickSave()
    await waitFor(() => expect(data.saveAlbumOrganization).toHaveBeenCalledTimes(1))
    expect(data.saveAlbumOrganization).toHaveBeenCalledWith({
      album: 'Engagement',
      order: ['eng-1', 'eng-3'],
      moves: [],
      deletes: ['eng-2'],
    })
    expect(screen.getByText(/Deleted 1 photo\./)).toBeInTheDocument()
  })

  it('guards against unload while changes are unsaved', async () => {
    await renderOrganizer()

    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Move Walking the orchard path earlier/i }))

    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
  })

  it('disables reorder while search is active and filters the grid', async () => {
    await renderOrganizer()

    fireEvent.change(screen.getByLabelText('Find a photo in Engagement'), {
      target: { value: 'orchard' },
    })

    expect(screen.getByText('Clear search to drag reorder.')).toBeInTheDocument()
    expect(screen.getByTestId('organizer-photo-eng-2')).toBeInTheDocument()
    expect(screen.queryByTestId('organizer-photo-eng-1')).not.toBeInTheDocument()

    const earlierButton = screen.getByRole('button', {
      name: /Move Walking the orchard path earlier/i,
    })
    expect(earlierButton).toBeDisabled()
    expect(screen.getByTestId('organizer-photo-eng-2')).toHaveAttribute('draggable', 'false')
  })

  it('lazy-loads each album once and resets search when switching', async () => {
    const data = await renderOrganizer()
    expect(data.fetchAlbumPhotos).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: /Wedding Day/ }))
    await screen.findByText('First look on the lawn')
    expect(data.fetchAlbumPhotos).toHaveBeenCalledTimes(2)
    expect(data.fetchAlbumPhotos).toHaveBeenLastCalledWith('Wedding Day')

    fireEvent.click(screen.getByRole('tab', { name: /Engagement/ }))
    await screen.findByText('Ring details on the moss')
    // Cached: no third read.
    expect(data.fetchAlbumPhotos).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state for an album with no photos', async () => {
    await renderOrganizer()

    fireEvent.click(screen.getByRole('tab', { name: /Guest Uploads/ }))
    await screen.findByText('No photos in Guest Uploads yet.')
    expect(screen.getByText('Add photos to this album to get started.')).toBeInTheDocument()
  })
})
