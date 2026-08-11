import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main id="main-content" className="page-shell not-found">
      <p className="error-code" aria-hidden="true">
        404
      </p>
      <p className="eyebrow">Wrong turn</p>
      <h1>This stop isn’t on our route.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <div className="confirmation-actions">
        <Link className="primary inline" to="/">
          Find a bus
        </Link>
        <Link className="outline-button" to="/my-bookings">
          View my bookings
        </Link>
      </div>
    </main>
  )
}
