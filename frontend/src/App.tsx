import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAppStore } from './store'
import { AuthPage } from './pages/Auth'
import { BusDetailsPage } from './pages/BusDetails'
import { ConfirmationPage, MyBookingsPage } from './pages/Bookings'
import { CheckoutPage } from './pages/Checkout'
import { HomePage } from './pages/Home'
import { SearchPage } from './pages/Search'

function Protected({ children }: { children: React.ReactNode }) { const user = useAppStore((state) => state.user); const location = useLocation(); return user ? <>{children}</> : <Navigate to="/login" state={{ from: location.pathname }} replace /> }
export default function App() { return <Layout><Routes><Route path="/" element={<HomePage />} /><Route path="/search" element={<SearchPage />} /><Route path="/bus/:busId" element={<BusDetailsPage />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/checkout/:tripId" element={<Protected><CheckoutPage /></Protected>} /><Route path="/booking-confirmation/:bookingGroupId" element={<Protected><ConfirmationPage /></Protected>} /><Route path="/my-bookings" element={<Protected><MyBookingsPage /></Protected>} /></Routes></Layout> }
