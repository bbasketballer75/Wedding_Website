import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Label } from './Label'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders the frozen textarea classes', () => {
    render(<Textarea placeholder='Write a note' data-testid='textarea' />)

    const textarea = screen.getByTestId('textarea')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveClass('min-h-[120px]')
    expect(textarea).toHaveClass('rounded-xl')
    expect(textarea).toHaveClass('bg-white/70')
    expect(textarea).toHaveClass('resize-none')
    expect(textarea).toHaveClass('border-gold-200/60')
  })

  it('accepts typing and is label-associated by id', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Label htmlFor='note'>Your note</Label>
        <Textarea id='note' />
      </>
    )

    const textarea = screen.getByLabelText('Your note')
    await user.type(textarea, 'Congratulations!')
    expect(textarea).toHaveValue('Congratulations!')
  })

  it('wires the hint id into aria-describedby', () => {
    render(<Textarea id='note' hint='120 characters max.' />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('aria-describedby', 'note-hint')
    expect(screen.getByText('120 characters max.')).toHaveAttribute('id', 'note-hint')
  })

  it('renders an error alert, marks aria-invalid and suppresses the hint', () => {
    render(<Textarea id='note' error='A note is required.' hint='Optional hint' />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    // Frozen behavior: `aria-describedby` lists every generated help id, even
    // when the error branch suppresses the hint element itself.
    expect(textarea).toHaveAttribute('aria-describedby', 'note-hint note-error')
    expect(textarea).toHaveClass('border-rose-400')
    expect(screen.getByRole('alert')).toHaveTextContent('A note is required.')
    expect(screen.queryByText('Optional hint')).not.toBeInTheDocument()
  })

  it('omits the described-by wiring when no id is provided', () => {
    render(<Textarea hint='No id' />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).not.toHaveAttribute('aria-describedby')
    expect(screen.getByText('No id')).not.toHaveAttribute('id')
  })

  it('respects disabled and merges a custom className', () => {
    render(<Textarea disabled className='custom' />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
    expect(textarea).toHaveClass('custom')
  })

  it('forwards the DOM ref', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} />)

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })
})
