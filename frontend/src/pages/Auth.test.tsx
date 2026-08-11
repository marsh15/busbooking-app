import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthPage } from './Auth'

vi.mock('../lib/api', () => ({
  client: {
    login: vi.fn(),
    register: vi.fn(),
  },
}))

function LocationState() {
  const location = useLocation()
  return <output>{JSON.stringify(location.state)}</output>
}

describe('AuthPage', () => {
  it('keeps the post-auth destination when switching to registration', async () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            { pathname: '/login', state: { from: '/checkout/trip-1?offer=summer#passengers' } },
          ]}
        >
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<LocationState />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('link', { name: 'Create one' }))

    expect(screen.getByText('{"from":"/checkout/trip-1?offer=summer#passengers"}')).toBeInTheDocument()
  })
})
