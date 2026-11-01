# EpicEventz attendee app

React/Vite attendee experience for Salesforce-backed event discovery, reservations, OTP sign-in, attendee bookings, and digital tickets.

## Run locally

Start the Express API from `attendee-backend` (`node server.js`), then start the frontend from this directory:

```powershell
npm run dev
```

The Vite app defaults to `http://localhost:5173` and the API to `http://localhost:3001`. Set `VITE_API_URL` in a local Vite environment file if the API is hosted elsewhere. Do not put credentials or private keys in `VITE_` variables; frontend variables are exposed to browsers.

The `/login` page reuses the backend email OTP endpoints. Attendee contacts are created by the existing booking flow; there is no separate registration endpoint or password-based login. `/account` (also `/dashboard`), `/booking-history`, `/spending`, `/cancellations`, `/feedback`, `/my-tickets`, and `/tickets/:reference` require the existing HTTP-only attendee session. `/ai-assistant` uses a rule-based search of actual Salesforce event records; no AI provider or AI key is configured.

The current Salesforce event API does not expose event descriptions, image URLs, event categories, or event times. There is no attendee feedback API. Spending uses paid registration amounts and subtracts only cancellation requests whose refund status is explicitly `Completed` or `Refunded`. The demo checkout is not a real payment integration, and cancellation eligibility/policy remains organizer-controlled. These missing capabilities are identified in the UI rather than represented with fabricated data. Ticket QR codes are returned only when the backend has a `TICKET_SIGNING_SECRET`; they contain an encrypted opaque registration identifier and point to server-side verification.

See [the backend README](../attendee-backend/README.md) for API configuration and limitations.
