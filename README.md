# GrandStay — Full Working Booking System

This is a **full-stack portfolio/demo booking system**, not a connection to a real hotel. It has a real server API and persistent server-side reservation data (stored in `data/db.json`).

## Requirements
- Node.js 18 or newer
- Internet connection for Google Fonts and the room photographs (the booking API itself runs locally)

## Run it
1. Extract the ZIP.
2. Open the project folder in VS Code.
3. Open the terminal in that folder.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

No database installation is needed. Reservations are saved in `data/db.json` and remain after restarting the server.

## Demo staff login
- URL: `http://localhost:3000/admin.html`
- Username: `admin`
- Password: `GrandStayAdmin2026!`

Change the demo password before showing the project publicly. You can set environment variables:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PORT`

Example (PowerShell):
```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="your-strong-password"
$env:SESSION_SECRET="a-long-random-secret-value"
npm start
```

## Working features
- Date-based room search with guest-capacity filtering.
- Server-side availability checks that prevent overlapping confirmed bookings for the same room.
- Server-calculated nightly rate, 12% demo tax and total.
- Guest reservation form and unique confirmation reference.
- Persistent reservation records in JSON on the server.
- Booking lookup using reference + matching email.
- Guest cancellation of confirmed bookings.
- Staff login with signed, HTTP-only admin cookie.
- Admin dashboard with booking totals, booked value, room price updates, room listing visibility, and reservation status management.
- Responsive layout and dark-mode toggle.

## Important limitations
- **No real payment is taken.** The confirmation is a demo reservation; no card details are collected.
- **No email/SMS is sent.** The confirmation is shown on screen and can be looked up later.
- **No real hotel inventory is connected.** The sample rooms, prices, and bookings belong only to this project.
- The JSON file store is suitable for a small single-server portfolio demonstration. For real multi-user production use, move to PostgreSQL/MySQL, add rate limiting and CSRF protection, use HTTPS, use a production session store, and integrate a real payment provider and hotel inventory system.
- The displayed prices are sample USD prices and the 12% tax is a demo assumption; change them in `data/db.json` and `server.js` to match a chosen fictional scenario.

## Project structure
```text
GrandStay-Full-Booking-System/
├── server.js
├── package.json
├── data/
│   └── db.json
└── public/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── admin.html
    └── admin.js
```
