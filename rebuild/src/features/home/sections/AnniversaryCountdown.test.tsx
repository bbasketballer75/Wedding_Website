import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installMotionStubs } from '../test-helpers'
import { AnniversaryCountdown } from './AnniversaryCountdown'

installMotionStubs()

describe('AnniversaryCountdown', () => {
  it('renders the frozen elapsed state with an injected clock', () => {
    render(<AnniversaryCountdown now={new Date('2026-11-08T17:00:00.000Z')} />)

    // contracts/ui.json fixedNow — the oracle renders "1 year, 181 days".
    expect(screen.getByText(/1 year, 181 days/)).toBeInTheDocument()
    expect(screen.getByText('married')).toBeInTheDocument()
    expect(screen.getByText(/Austin & Jordyn · May 10, 2025/)).toBeInTheDocument()
  })

  it('renders "Today!" on the wedding day itself', () => {
    render(<AnniversaryCountdown now={new Date('2025-05-10T17:00:00-05:00')} />)

    expect(screen.getByText('Today!')).toBeInTheDocument()
    // The anniversary instant has passed, so the countdown branch is not used.
    expect(screen.queryByText(/Counting down/)).not.toBeInTheDocument()
  })

  it('omits the elapsed days when an exact year has passed', () => {
    render(<AnniversaryCountdown now={new Date('2026-05-11T22:00:00.000Z')} />)

    const elapsed = screen.getByText(/^1 year$/)
    expect(elapsed).toBeInTheDocument()
    expect(elapsed).not.toHaveTextContent(',')
  })

  it('renders the frozen countdown state inside the 30-day anniversary window', () => {
    render(<AnniversaryCountdown now={new Date('2026-05-01T12:00:00-04:00')} />)

    expect(screen.getByText(/1st anniversary/)).toBeInTheDocument()
    expect(screen.getByText(/Counting down to Austin & Jordyn's anniversary/)).toBeInTheDocument()
    expect(screen.getByText('08')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getAllByText('00')).toHaveLength(2)
    expect(screen.getByText('days')).toBeInTheDocument()
    // The frozen seconds unit is the pulsing one (index 3).
    expect(
      screen.getAllByText('00').some(element => element.classList.contains('animate-pulse-soft'))
    ).toBe(true)
  })

  it('renders the 2nd anniversary ordinal label', () => {
    render(<AnniversaryCountdown now={new Date('2027-05-01T12:00:00-04:00')} />)

    expect(screen.getByText(/2nd anniversary/)).toBeInTheDocument()
  })

  it('renders without an injected clock (live timer path) and cleans up', () => {
    const { unmount } = render(<AnniversaryCountdown />)

    expect(screen.getByText('married')).toBeInTheDocument()
    unmount()
  })
})
