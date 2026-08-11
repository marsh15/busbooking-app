# VoyageBus frontend

The VoyageBus client is a React 19/Vite single-page application. URL search parameters own shareable trip filters, TanStack Query owns remote state, React Hook Form and Zod own form validation, and Zustand holds only short-lived session UI state such as the current trip's selected seats.

## Commands

```bash
npm ci
npm run dev
npm test
npm run lint
npm run format:check
npm run build
npm run test:e2e
```

Set `VITE_API_BASE_URL=/api` for the same-origin local and deployed configuration.

## UI structure

- `src/pages/Home.tsx` — manual and natural-language trip discovery
- `src/pages/Search.tsx` — URL-backed filters, pagination, and result states
- `src/pages/BusDetails.tsx` — authoritative trip detail and accessible seat selection
- `src/pages/Checkout.tsx` — trip-scoped passenger forms and conflict recovery
- `src/pages/Bookings.tsx` — confirmation, history, and focus-managed cancellation
- `src/components/Layout.tsx` — session restoration, responsive navigation, skip link, and footer

The frontend treats displayed availability as advisory. Booking success always comes from the API transaction.
