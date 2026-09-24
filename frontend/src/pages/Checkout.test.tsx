import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../store'
import { CheckoutPage } from './Checkout'
import { client } from '../lib/api'
import type { SeatHold } from '../types'

vi.mock('../lib/api', () => ({
  client: {
    tripById: vi
      .fn()
      .mockResolvedValue({ busName: 'Amber Star', fare: 1020, busId: 'bus-1', id: 'trip-1', policy: null }),
    hold: vi.fn(),
    getHold: vi.fn(),
    releaseHold: vi.fn(),
    confirm: vi.fn(),
    getAttempt: vi.fn(),
  },
}))

const activeHold: SeatHold = {
  id: 'hold-1',
  tripId: 'trip-1',
  state: 'ACTIVE',
  expiresAt: new Date(Date.now() + 9 * 60_000).toISOString(),
  farePerSeat: 1020,
  seatNumbers: ['1A', '1B'],
  trip: {
    id: 'trip-1',
    busName: 'Amber Star',
    operator: 'Marigold Trail Travels',
    travelDate: '2030-01-10',
    departureTime: '07:30',
    arrivalTime: '13:30',
    route: 'Hyderabad → Vijayawada',
  },
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    useAppStore.setState({ selectedTripId: 'trip-1', selectedSeats: ['1A', '1B'] })
    vi.mocked(client.hold).mockReset().mockResolvedValue(activeHold)
    vi.mocked(client.getHold).mockReset().mockResolvedValue(activeHold)
    sessionStorage.clear()
  })

  it('acquires a hold and lets travellers clear and replace their full name', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/checkout/trip-1']}>
          <Routes>
            <Route path="/checkout/:tripId" element={<CheckoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('timer')).toBeInTheDocument()
    expect(client.hold).toHaveBeenCalledWith('trip-1', ['1A', '1B'])
    const name = (await screen.findAllByLabelText('Full name'))[0]
    const user = userEvent.setup()

    await user.type(name, 'Demo Traveller')
    await user.clear(name)
    await user.type(name, 'Asha Rao')

    expect(name).toHaveValue('Asha Rao')
  }, 15_000)

  it('explains the hold has ended when the server reports it expired', async () => {
    vi.mocked(client.hold).mockResolvedValue({ ...activeHold, state: 'EXPIRED' })
    vi.mocked(client.getHold).mockResolvedValue({ ...activeHold, state: 'EXPIRED' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/checkout/trip-1']}>
          <Routes>
            <Route path="/checkout/:tripId" element={<CheckoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'Your hold on these seats has ended' })).toBeInTheDocument()
  })

  it('does not carry seats into checkout for another trip', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/checkout/trip-2']}>
          <Routes>
            <Route path="/checkout/:tripId" element={<CheckoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Choose seats first' })).toBeInTheDocument()
  })
})
