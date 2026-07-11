import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SeatMap } from './SeatMap'
import type { Seat } from '../types'

const seats: Seat[] = Array.from({ length: 8 }, (_, index) => ({ id: String(index), number: `${index + 1}A`, deck: 1, row: index + 1, column: 1, status: index === 7 ? 'BOOKED' : 'AVAILABLE' }))

describe('SeatMap', () => {
  it('announces availability and blocks booked seats', () => {
    render(<SeatMap seats={seats} selected={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Seat 8A, booked' })).toBeDisabled()
    expect(screen.getByText('0 selected')).toHaveAttribute('aria-live', 'polite')
  })

  it('selects an available seat', async () => {
    const onChange = vi.fn()
    render(<SeatMap seats={seats} selected={[]} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Seat 1A, available' }))
    expect(onChange).toHaveBeenCalledWith(['1A'])
  })

  it('does not select more than six seats', async () => {
    const onChange = vi.fn()
    render(<SeatMap seats={seats} selected={['1A', '2A', '3A', '4A', '5A', '6A']} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Seat 7A, available' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
