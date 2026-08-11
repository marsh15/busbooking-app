# VoyageBus — Product Requirements Document

## Target users

Travellers in South India who want a simple way to discover buses, choose seats, and make a simulated booking.

## Problem

Bus booking sites can feel crowded and make trip discovery difficult. Users need a clear, mobile-friendly flow with both normal and natural-language trip search.

## Value proposition

VoyageBus offers a calm, straightforward bus-booking experience with AI-assisted search, visible seat availability, multi-seat mock bookings, and ticket-level cancellation.

## Must-have features

- Email/password registration and login
- Secure session-based authentication
- Manual source, destination, and date search
- Natural-language search that produces editable trip fields
- Search results with filters and sorting
- Bus details, amenities, policies, and live seat maps
- Selection of up to six seats
- Passenger details and simulated payment review
- Booking confirmation with a PNR-style reference
- Booking history grouped by checkout
- Ticket-level cancellation with mock refund estimates

## Non-goals

- Real payments or refunds
- Operator/admin portal
- Coupons, insurance, boarding points, or live GPS tracking
- Multi-country or multi-timezone support
- Inventing bus availability through AI

## User stories

- As a traveller, I can search for buses by source, destination, and date.
- As a traveller, I can describe a journey in natural language and edit the parsed result.
- As a traveller, I can inspect a bus before selecting seats.
- As a signed-in traveller, I can book multiple seats in one checkout.
- As a traveller, I can view my previous bookings and cancel one active ticket.

## Seeded routes

- Hyderabad–Vijayawada
- Hyderabad–Bengaluru
- Bengaluru–Chennai
- Chennai–Coimbatore
- Kochi–Thiruvananthapuram
- Visakhapatnam–Hyderabad

Seed 24 one-way trips across today and tomorrow in `Asia/Kolkata`, including AC/non-AC and sleeper/seater options.

## Success criteria

- The six specified South India routes are searchable for seeded today/tomorrow trips.
- A user can complete the full mock booking journey.
- Concurrent attempts to book the same seat allow exactly one successful booking.
- Cancelling one ticket releases only its seat and updates the booking group status.
- The app remains usable when the OpenAI key is absent.
