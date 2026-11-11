import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Label } from './Label'

describe('Label', () => {
  it('renders the frozen label classes and forwards htmlFor', () => {
    render(
      <>
        <Label htmlFor='guest-name'>Your name</Label>
        <input id='guest-name' />
      </>
    )

    const label = screen.getByText('Your name')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'guest-name')
    expect(label).toHaveClass('text-xs')
    expect(label).toHaveClass('uppercase')
    expect(label).toHaveClass('tracking-[0.15em]')
    expect(label).toHaveClass('text-charcoal-600')
    expect(label).toHaveClass('mb-2')
    expect(label).toHaveClass('block')
  })

  it('is programmatically associated with its control', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Label htmlFor='note'>Leave a note</Label>
        <textarea id='note' />
      </>
    )

    await user.click(screen.getByText('Leave a note'))
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('merges a custom className and forwards the ref', () => {
    const ref = createRef<HTMLLabelElement>()
    render(
      <Label ref={ref} htmlFor='x' className='custom'>
        Label
      </Label>
    )

    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
    expect(screen.getByText('Label')).toHaveClass('custom')
  })

  it('still renders without an htmlFor (association owned by composition)', () => {
    render(<Label data-testid='bare'>Bare</Label>)

    const label = screen.getByTestId('bare')
    expect(label).not.toHaveAttribute('for')
    expect(label).toHaveTextContent('Bare')
  })
})
