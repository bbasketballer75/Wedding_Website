import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ANALYTICS_FIXTURES, FIXTURE_ANALYTICS_COUNTS, type AnalyticsData } from './analytics-data'
import { AnalyticsPage } from './AnalyticsPage'

/**
 * Analytics tests: the window buttons drive the injected count read (7/30/90),
 * the frozen stat copy renders, and the "database activity only" notice is
 * present (traffic dashboards live outside the app).
 */

function createData() {
  return {
    fetchCounts: vi.fn(ANALYTICS_FIXTURES.fetchCounts),
  }
}

async function renderLoadedPage(data: AnalyticsData = createData()) {
  render(<AnalyticsPage data={data} />)
  await waitFor(() => expect(data.fetchCounts).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument())
  return data
}

describe('AnalyticsPage', () => {
  it('loads the default 30-day window and renders the frozen stat cards', async () => {
    const data = await renderLoadedPage()

    expect(data.fetchCounts).toHaveBeenCalledWith('30d')
    expect(screen.getByRole('heading', { name: 'Analytics Dashboard' })).toBeInTheDocument()

    expect(screen.getByText('Approved Uploads')).toBeInTheDocument()
    expect(screen.getByText('Pending Uploads')).toBeInTheDocument()
    expect(screen.getByText('Guestbook Entries')).toBeInTheDocument()
    expect(screen.getByText('Photos Published')).toBeInTheDocument()
    expect(screen.getByText('Guest Photos Published')).toBeInTheDocument()
    expect(screen.getByText('Professional Photos Added')).toBeInTheDocument()

    const month = FIXTURE_ANALYTICS_COUNTS['30d']
    expect(screen.getByText(month.approvedUploads.toString())).toBeInTheDocument()
    expect(screen.getByText(month.guestbookEntries.toString())).toBeInTheDocument()
    expect(screen.getByText(/Requires attention/)).toBeInTheDocument()
    expect(screen.getByText('Database Activity Only')).toBeInTheDocument()
  })

  it('marks the active window and requests the matching range', async () => {
    const data = await renderLoadedPage()

    const thirtyDays = screen.getByRole('button', { name: 'Last 30 Days' })
    expect(thirtyDays).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Last 90 Days' }))

    await waitFor(() => expect(data.fetchCounts).toHaveBeenLastCalledWith('90d'))
    expect(screen.getByRole('button', { name: 'Last 90 Days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const quarter = FIXTURE_ANALYTICS_COUNTS['90d']
    await waitFor(() =>
      expect(screen.getByText(quarter.publishedPhotos.toString())).toBeInTheDocument()
    )
  })

  it('requests the 7-day window when selected', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }))
    await waitFor(() => expect(data.fetchCounts).toHaveBeenLastCalledWith('7d'))
    const week = FIXTURE_ANALYTICS_COUNTS['7d']
    await waitFor(() =>
      expect(screen.getAllByText(week.approvedUploads.toString()).length).toBeGreaterThan(0)
    )
  })

  it('shows the frozen error copy and zeroed counts when the read fails', async () => {
    const data: AnalyticsData = {
      fetchCounts: vi.fn(() => Promise.reject(new Error('offline'))),
    }
    render(<AnalyticsPage data={data} />)

    await screen.findByText('Failed to load analytics')
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4)
  })
})
