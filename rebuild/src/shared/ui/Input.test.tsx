import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'
import { Label } from './Label'

describe('Input', () => {
  it('renders the frozen input classes and forwards native props', () => {
    render(<Input id='email' type='email' placeholder='you@example.com' data-testid='input' />)

    const input = screen.getByTestId('input')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'you@example.com')
    expect(input).toHaveClass('theme-input')
    expect(input).toHaveClass('h-11')
    expect(input).toHaveClass('rounded-xl')
    expect(input).toHaveClass('border-[color:var(--ui-border)]')
  })

  it('accepts typing and is label-associated by id', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Label htmlFor='guest-name'>Name</Label>
        <Input id='guest-name' />
      </>
    )

    const input = screen.getByLabelText('Name')
    await user.type(input, 'Austin')
    expect(input).toHaveValue('Austin')
  })

  it('wires the hint id into aria-describedby', () => {
    render(<Input id='email' hint='We never publish it.' />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-describedby', 'email-hint')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('We never publish it.')).toHaveAttribute('id', 'email-hint')
  })

  it('renders an error alert, marks aria-invalid and suppresses the hint', () => {
    render(<Input id='name' error='Tell us your name.' hint='Optional hint' />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    // Frozen behavior: `aria-describedby` lists every generated help id, even
    // when the error branch suppresses the hint element itself.
    expect(input).toHaveAttribute('aria-describedby', 'name-hint name-error')
    expect(input).toHaveClass('border-rose-400')
    expect(screen.getByRole('alert')).toHaveTextContent('Tell us your name.')
    expect(screen.queryByText('Optional hint')).not.toBeInTheDocument()
  })

  it('omits the described-by wiring when no id is provided', () => {
    render(<Input hint='No id' error='' />)

    const input = screen.getByRole('textbox')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.getByText('No id')).not.toHaveAttribute('id')
  })

  it('respects disabled and merges a custom className', () => {
    render(<Input disabled className='custom' />)

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('custom')
    expect(input).toHaveClass('disabled:opacity-50')
  })

  it('forwards the DOM ref', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
