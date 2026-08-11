import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAppStore } from './store'

const AuthPage = lazy(async () => ({ default: (await import('./pages/Auth')).AuthPage }))
const BusDetailsPage = lazy(async () => ({ default: (await import('./pages/BusDetails')).BusDetailsPage }))
const CheckoutPage = lazy(async () => ({ default: (await import('./pages/Checkout')).CheckoutPage }))
const ConfirmationPage = lazy(async () => ({ default: (await import('./pages/Bookings')).ConfirmationPage }))
const HomePage = lazy(async () => ({ default: (await import('./pages/Home')).HomePage }))
const MyBookingsPage = lazy(async () => ({ default: (await import('./pages/Bookings')).MyBookingsPage }))
const NotFoundPage = lazy(async () => ({ default: (await import('./pages/NotFound')).NotFoundPage }))
const SearchPage = lazy(async () => ({ default: (await import('./pages/Search')).SearchPage }))

function PageFallback() {
  return (
    <main id="main-content" className="page-shell">
      <div className="skeleton detail-skeleton" aria-busy="true" aria-label="Loading page" />
    </main>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user)
  const authReady = useAppStore((state) => state.authReady)
  const location = useLocation()

  if (!authReady) {
    return (
      <main id="main-content" className="page-shell">
        <div className="skeleton detail-skeleton" aria-busy="true" aria-label="Restoring your session" />
      </main>
    )
  }

  return user ? (
    <>{children}</>
  ) : (
    <Navigate
      to="/login"
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      replace
    />
  )
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bus/:busId" element={<BusDetailsPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route
            path="/checkout/:tripId"
            element={
              <Protected>
                <CheckoutPage />
              </Protected>
            }
          />
          <Route
            path="/booking-confirmation/:bookingGroupId"
            element={
              <Protected>
                <ConfirmationPage />
              </Protected>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <Protected>
                <MyBookingsPage />
              </Protected>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
