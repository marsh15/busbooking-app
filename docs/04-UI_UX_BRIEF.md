# VoyageBus — UI/UX Brief

## Visual direction

Use a warm, modern travel style. It should feel calm and helpful, not like a crowded booking aggregator.

## Color palette

- Warm navy: primary background, headings, and navigation
- Teal: primary actions, selected states, and focus treatment
- Orange: warnings, urgency, and exceptional highlights only
- Cool off-white: page backgrounds and large surfaces
- White: cards and inputs
- Teal/green: successful availability and confirmations
- Red: destructive cancellation actions and errors

Do not use color as the only way to communicate status.

## Typography and spacing

- Use a clean sans-serif typeface.
- Give pages generous whitespace and clear visual grouping.
- Use a consistent spacing scale.
- Keep body text readable on mobile devices.
- Make prices, departure times, and available-seat counts easy to scan.

## Responsive layout

- Mobile-first design.
- Search forms stack vertically on small screens.
- Desktop search filters can use a sidebar; mobile uses a drawer or collapsible panel.
- Seat maps remain usable at narrow widths with horizontal scrolling only when necessary.
- Checkout and passenger forms remain one-column on mobile.

## Component language

- Rounded cards with subtle borders and restrained shadows.
- Large, obvious primary buttons.
- Clear input labels; never rely on placeholder text alone.
- Seat states: available, selected, booked, unavailable, and aisle.
- Destructive actions require a confirmation modal.
- Use chips for AI-parsed search fields and active filters.

## Accessibility rules

- Full keyboard navigation for every interactive element.
- Visible focus indicators.
- Semantic buttons, inputs, labels, headings, and landmarks.
- Accessible names for icon-only controls.
- Form errors must be announced and shown near their fields.
- Modal focus is trapped while open and restored when closed.
- Meet WCAG AA color contrast.
- Respect reduced-motion preferences.

## Interaction behavior

- Disable submit buttons while requests are pending.
- Show immediate feedback when a seat is selected or deselected.
- Use short, purposeful transitions only.
- Keep selected seats visible throughout checkout.
- Do not confirm a booking until the server succeeds.
- Show a clear recovery message if a selected seat becomes unavailable.
