# Le Roux Dental Care — Demo Website

A single-page demo website for a dental practice, built to show a client what a booking-enabled site could look like. **This is placeholder content** — practice name, address, phone number, banking details, and prices are all fictional and meant to be replaced with a real client's details.

## What's included

- **Services & pricing** — editable list of treatments with default ZAR prices
- **Book Appointment** — patients submit a booking with a required proof-of-payment upload (image or PDF). Bookings stay "Pending" until staff confirm them.
- **Contact form & details** — address, phone, email, hours, plus a message form
- **Admin dashboard** (footer link, "Staff sign in", default password `dental2026`)
  - Bookings — filter, view proof of payment, Accept / Decline / Mark completed / Reschedule / Delete
  - Calendar — month view with appointment markers, upcoming list
  - Messages — contact form submissions
  - Settings — practice details, banking details, services & prices, booking hours, admin password
- Basic slot-conflict prevention and opening-hours enforcement on the booking form
- Mobile-friendly navigation

## How data is stored

The site auto-detects its environment:
- Opened inside **Claude** as an artifact, it uses Claude's shared artifact storage (bookings/messages are shared across everyone viewing it).
- Opened as a **regular website** (e.g. GitHub Pages), it falls back to the browser's own `localStorage`. Data is then private to that browser/device and will not sync across visitors or devices — fine for a demo or a single front-desk computer, but a real production version should move this to a proper backend/database so all staff and patients share the same data reliably.

## Running it

Just open `index.html` in a browser, or serve the folder with any static host (GitHub Pages, Netlify, etc.) — no build step required.

## Known limitations (worth knowing before pitching this as a finished product)

- The admin password is a simple client-side check, not real authentication.
- There's no email/SMS notification when a booking comes in — staff need to check the dashboard.
- No online payment gateway — patients upload proof of an EFT they've already made.
