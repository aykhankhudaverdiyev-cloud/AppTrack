// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DatePicker from '../src/components/section/DatePicker'

afterEach(cleanup)
function Harness({ initial = '', changed = () => {}, ...props }) {
  const [value, setValue] = useState(initial)
  return <DatePicker label="Date" value={value} onChange={v => { changed(v); setValue(v) }} {...props} />
}
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))

describe('DatePicker', () => {
  it('selects a month and keeps it after blur', () => {
    const changed = vi.fn()
    render(<Harness changed={changed} />)
    open()
    const currentYear = new Date().getFullYear()
    for (let y = currentYear; y > 2026; y--) fireEvent.click(screen.getByRole('button', { name: 'Previous year' }))
    for (let y = currentYear; y < 2026; y++) fireEvent.click(screen.getByRole('button', { name: 'Next year' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feb 2026' }))
    expect(screen.getByLabelText('Date')).toHaveValue('Feb 2026')
    fireEvent.blur(screen.getByLabelText('Date'))
    expect(screen.getByLabelText('Date')).toHaveValue('Feb 2026')
    expect(changed).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledWith('2026-02-01')
  })
  it('commits a typed month', () => {
    const changed = vi.fn(); render(<Harness changed={changed} />)
    const input = screen.getByLabelText('Date'); fireEvent.change(input, { target: { value: '02/2026' } }); fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.blur(input)
    expect(input).toHaveValue('Feb 2026'); expect(changed).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledWith('2026-02-01')
  })
  it('opens on and highlights the selected month', () => {
    render(<Harness initial="2026-02-01" />); open()
    expect(screen.getByText('2026')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Feb 2026' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('clears using both controls and sets this month', () => {
    const changed = vi.fn(); render(<Harness initial="2026-02-01" changed={changed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' })); expect(changed).toHaveBeenLastCalledWith('')
    open(); fireEvent.click(screen.getByText('This month')); const now = new Date(); expect(changed).toHaveBeenLastCalledWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    open(); fireEvent.click(screen.getByText('Clear')); expect(changed).toHaveBeenLastCalledWith('')
  })
  it('selects a day', () => {
    const changed = vi.fn(); render(<Harness mode="day" initial="2023-09-01" changed={changed} />); open()
    fireEvent.click(screen.getByRole('button', { name: '12 Sep 2023' })); expect(screen.getByLabelText('Date')).toHaveValue('12 Sep 2023'); expect(changed).toHaveBeenCalledWith('2023-09-12')
  })
  it('disables and rejects out of range months while keeping text', () => {
    render(<Harness initial="2026-02-01" min="2026-02-01" />); open()
    expect(screen.getByRole('button', { name: 'Jan 2026' })).toBeDisabled()
    const input = screen.getByLabelText('Date'); fireEvent.change(input, { target: { value: '01/2026' } }); fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('01/2026'); expect(screen.getByText(/must be|range|before/i)).toBeInTheDocument()
  })
  it('calls onBlur after selection with the new value', () => {
    const blur = vi.fn(); render(<Harness initial="2026-01-01" onBlur={blur} />); open(); fireEvent.click(screen.getByRole('button', { name: 'Feb 2026' }))
    expect(blur).toHaveBeenCalledOnce(); expect(blur).toHaveBeenCalledWith('2026-02-01')
  })
})
