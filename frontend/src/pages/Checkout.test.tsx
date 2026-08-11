import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../store'
import { CheckoutPage } from './Checkout'

vi.mock('../lib/api', () => ({
  client: {
    tripById: vi.fn().mockResolvedValue({ busName: 'Amber Star', fare: 1020 }),
    book: vi.fn(),
  },
}))

describe('CheckoutPage', () => {
  beforeEach(() => useAppStore.setState({ selectedTripId: 'trip-1', selectedSeats: ['1A', '1B'] }))

  it('lets travellers clear and replace their full name', async () => {
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
    const name = (await screen.findAllByLabelText('Full name'))[0]
    const user = userEvent.setup()

    await user.type(name, 'Demo Traveller')
    await user.clear(name)
    await user.type(name, 'Asha Rao')

    expect(name).toHaveValue('Asha Rao')
  }, 15_000)

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

    expect(screen.getByRole('heading', { name: 'Choose seats first.' })).toBeInTheDocument()
  })
})
