# VoyageBus — App Flow

## Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Home page with manual and AI-assisted search | Public |
| `/search` | Matching trips, filters, sorting, and recovery states | Public |
| `/bus/:busId?tripId=:tripId` | Bus details, policies, amenities, and seat map | Public |
| `/checkout/:tripId` | Passenger details and mock payment review | Protected |
| `/booking-confirmation/:bookingGroupId` | PNR-style confirmation and tickets | Protected |
| `/login` | Sign in | Public |
| `/register` | Create account | Public |
| `/my-bookings` | Booking groups and ticket-level cancellation | Protected |

## Navigation rules

- The header links to Home, My Bookings, Login/Register, or Logout.
- A protected route redirects an unauthenticated user to `/login`.
- After successful login, return the user to their originally requested protected route.
- A completed checkout redirects to the booking confirmation page.

## Manual-search journey

1. User selects source, destination, and travel date on Home.
2. App navigates to `/search` with search parameters.
3. User filters and sorts matching trips.
4. User opens a bus and trip detail page.
5. User selects up to six available seats.
6. Unauthenticated users are sent to Login, then returned to Checkout.
7. User enters passenger details and confirms simulated payment.
8. App displays booking confirmation.

## AI-search journey

1. User enters a short natural-language query.
2. The app displays parsed, editable fields and warnings.
3. The user confirms the search.
4. The app follows the normal search-results journey.

## Cancellation journey

1. User opens My Bookings.
2. User selects one active ticket to cancel.
3. A modal shows the mock refund estimate and cancellation deadline.
4. User confirms cancellation.
5. Only that ticket becomes cancelled and its seat is released.

## UI states

- Loading: use skeletons for search results, bus details, and bookings.
- Empty: show a helpful “No buses found” message with clear search-edit actions.
- Error: show a non-technical message with retry where applicable.
- Seat conflict: explain that another traveller booked the seat first and refresh availability.
- Form validation: show errors next to the relevant field and move focus to the first invalid field.
