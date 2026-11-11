import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  FEATURED_CONTENT_FIXTURES,
  type RecordEditorialHistoryInput,
  type UpsertEditorialFeatureInput,
} from './featured-content-data'
import { FeaturedContentPage } from './FeaturedContentPage'

/**
 * Featured-content tests: four frozen slots, load/save/off flows, the exact
 * upsert payload and the history entry written on save.
 */

function createData() {
  const saveFeature = vi.fn((input: UpsertEditorialFeatureInput) =>
    FEATURED_CONTENT_FIXTURES.saveFeature(input)
  )
  const appendHistory = vi.fn((input: RecordEditorialHistoryInput) => {
    void input
    return Promise.resolve()
  })
  const fetchFeature = vi.fn(FEATURED_CONTENT_FIXTURES.fetchFeature)
  const fetchHistory = vi.fn(FEATURED_CONTENT_FIXTURES.fetchHistory)
  return { saveFeature, appendHistory, fetchFeature, fetchHistory }
}

async function renderLoadedPage() {
  const data = createData()
  render(<FeaturedContentPage data={data} />)
  await screen.findByDisplayValue('The First Dance')
  return data
}

function getTitleInput(): HTMLElement {
  return screen.getByLabelText(/^Title/)
}

describe('FeaturedContentPage', () => {
  it('renders the four frozen slots and loads the first slot with its history', async () => {
    const data = await renderLoadedPage()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Moment of the Week',
      'Standout Upload',
      'Featured Note',
      'Film Feature',
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    expect(screen.getByText('Editorial slots')).toBeInTheDocument()
    expect(screen.getByText('Moment of the Week', { selector: 'p' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Appears as a cinematic card below the guest highlight reel on the homepage.'
      )
    ).toBeInTheDocument()

    // Loaded form values + live banner.
    expect(getTitleInput()).toHaveValue('The First Dance')
    expect(
      screen.getByText(/This slot is live — guests on the homepage see "The First Dance"/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Set "The First Dance" as the active Moment of the Week/)
    ).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Deactivate slot' })).toHaveAttribute(
      'aria-checked',
      'true'
    )

    expect(data.fetchFeature).toHaveBeenCalledWith('home_moment_of_the_week')
    expect(data.fetchHistory).toHaveBeenCalledWith('home_moment_of_the_week')
  })

  it('loads a different slot when a tab is selected', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByTestId('featured-slot-home_featured_guestbook_note'))

    await waitFor(() =>
      expect(data.fetchFeature).toHaveBeenLastCalledWith('home_featured_guestbook_note')
    )
    expect(
      screen.getByText('Surfaces a guestbook message as a featured quote on the homepage.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('This slot is off — nothing is shown to guests right now')
    ).toBeInTheDocument()
    expect(getTitleInput()).toHaveValue('')
  })

  it('validates the required title before saving', async () => {
    const data = await renderLoadedPage()

    fireEvent.change(getTitleInput(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(data.saveFeature).not.toHaveBeenCalled()
    expect(data.appendHistory).not.toHaveBeenCalled()
  })

  it('saves the slot payload and appends the frozen history entry', async () => {
    const data = await renderLoadedPage()

    fireEvent.change(getTitleInput(), { target: { value: 'Dance floor under the stars' } })
    fireEvent.change(screen.getByLabelText(/^Summary/), {
      target: { value: 'A first dance to remember.' },
    })
    fireEvent.change(screen.getByLabelText(/^Badge label/), {
      target: { value: 'Moment of the Week' },
    })
    fireEvent.change(screen.getByLabelText(/^CTA label/), {
      target: { value: 'View the moment' },
    })
    fireEvent.change(screen.getByLabelText(/^Link URL/), {
      target: { value: 'https://example.com/moment' },
    })
    fireEvent.change(screen.getByLabelText('Content type'), { target: { value: 'custom' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() => expect(data.saveFeature).toHaveBeenCalledTimes(1))
    expect(data.saveFeature).toHaveBeenCalledWith({
      slot: 'home_moment_of_the_week',
      title: 'Dance floor under the stars',
      summary: 'A first dance to remember.',
      badgeLabel: 'Moment of the Week',
      ctaLabel: 'View the moment',
      sourceUrl: 'https://example.com/moment',
      sourceType: 'custom',
      isActive: true,
    })

    await waitFor(() => expect(data.appendHistory).toHaveBeenCalledTimes(1))
    const historyInput = data.appendHistory.mock.calls[0]?.[0]
    expect(historyInput?.slot).toBe('home_moment_of_the_week')
    expect(historyInput?.featureId).toBe('feat-1')
    expect(historyInput?.changeSummary).toBe(
      'Set "Dance floor under the stars" as the active Moment of the Week'
    )
    expect(historyInput?.previousFeature).toMatchObject({ title: 'The First Dance' })
    expect(historyInput?.nextFeature).toMatchObject({ title: 'Dance floor under the stars' })

    await screen.findByText('Moment of the Week is now live')
  })

  it('turning a slot off deactivates it and records the frozen history summary', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Turn off slot/i }))

    await waitFor(() => expect(data.saveFeature).toHaveBeenCalledTimes(1))
    expect(data.saveFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: 'home_moment_of_the_week',
        title: 'The First Dance',
        isActive: false,
      })
    )
    await waitFor(() => expect(data.appendHistory).toHaveBeenCalledTimes(1))
    expect(data.appendHistory.mock.calls[0]?.[0]?.changeSummary).toBe(
      'Deactivated Moment of the Week'
    )
    await screen.findByText('Moment of the Week turned off')
  })

  it('keeps the active toggle and source-type select keyboard-operable and labelled', async () => {
    await renderLoadedPage()

    const toggle = screen.getByRole('switch', { name: 'Deactivate slot' })
    toggle.focus()
    expect(toggle).toHaveFocus()
    fireEvent.click(toggle)
    expect(screen.getByRole('switch', { name: 'Activate slot' })).toHaveAttribute(
      'aria-checked',
      'false'
    )

    const sourceType = screen.getByLabelText('Content type')
    expect(within(sourceType).getAllByRole('option')).toHaveLength(4)
    fireEvent.change(sourceType, { target: { value: 'film_chapter' } })
    expect(sourceType).toHaveValue('film_chapter')
  })
})
