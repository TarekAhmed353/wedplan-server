# WedPlan (server)

WedPlan is a wedding planning platform. Couples browse wedding services and send booking requests. Vendors list their services, answer booking requests and can upgrade to Premium. Admins review services, manage users and see every payment.

This repository is the REST API, built with Express. The website lives in a separate repository.

## Links

- Live website: https://wedplan-client-taupe.vercel.app
- Live API: https://wedplan-server-ochre.vercel.app
- Client repository: https://github.com/TarekAhmed353/wedplan-client
- Server repository: https://github.com/TarekAhmed353/wedplan-server

## Important features

- JWT check on every protected route with `jose`. The token comes from Better Auth on the website and is checked against the website's public keys. Missing, wrong or expired tokens get 401.
- The user's role, blocked status and plan are always read from the database, never from the request. Wrong role, blocked user or unchosen role get 403.
- Ownership checks on every update and delete: vendors only change their own services and requests, customers only their own bookings.
- Every request body is validated, with clear JSON errors and the right status codes.
- Services start as pending. Only approved services that the vendor has switched on are public. Services from blocked vendors are hidden.
- Free vendors can have 3 active services. The limit is checked when adding a service, switching one back on, editing a rejected one and when an admin approves one again.
- Bookings start as pending. Only pending bookings can be accepted, rejected or cancelled, and only once, using single atomic database updates. Duplicate active requests for the same service and date are blocked.
- Stripe Checkout for Premium ($9.99 per month in test mode). A pending transaction is saved when checkout starts. Only the signature-verified webhook marks a payment as paid and turns Premium on. Renewals extend Premium, cancelling keeps it until the period ends, and a deleted subscription sends the vendor back to Free.
- Admins can search and block users (blocking also ends their sessions), review and delete services, and view transactions. There is no route that changes a payment.
- Public search with word matching across name, description, category and location, category and location filters, and price sorting.

## Technology stack

- Node.js with Express 5 (ES modules)
- MongoDB native driver
- jose for JWT verification
- Stripe for subscriptions and webhooks
- cors
- Deployed on Vercel

## Main routes

| Route | Who |
|---|---|
| `GET /api/services`, `GET /api/services/locations` | Public |
| `GET /api/services/:id` | Signed in |
| `POST /api/services`, `PATCH /api/services/:id`, `PATCH /api/services/:id/availability`, `DELETE /api/services/:id` | Vendor (own services) |
| `GET /api/vendor/plan`, `/stats`, `/services`, `/bookings` | Vendor |
| `PATCH /api/bookings/:id/respond` | Vendor (own requests) |
| `POST /api/bookings`, `PATCH /api/bookings/:id/cancel` | Customer |
| `GET /api/customer/stats`, `/bookings` | Customer |
| `POST /api/stripe/checkout`, `GET /api/stripe/session/:id`, `POST /api/stripe/cancel` | Vendor |
| `POST /api/stripe/webhook` | Stripe (signature checked) |
| `GET /api/admin/stats`, `/services`, `/users`, `/transactions`, plus status, block and delete routes | Admin |
| `GET /api/me` | Signed in |

## Installation

You need Node.js 20 or newer, a MongoDB database and a Stripe account in test mode. The website (client repository) must be running too, because the API reads its public keys.

```bash
git clone https://github.com/TarekAhmed353/wedplan-server.git
cd wedplan-server
npm install
```

Copy `.env.example` to `.env` and fill in the values:

| Variable | What it is |
|---|---|
| `PORT` | Local port, for example `8000` |
| `MONGODB_URI` | MongoDB connection string (same database as the website) |
| `DB_NAME` | Database name, for example `wedplan` |
| `CLIENT_URL` | Address of the website, for example `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe secret key from test mode |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of your webhook endpoint |
| `IMGBB_API_KEY` | Only needed for the demo data script |
| `SEED_VENDOR_PASSWORD` | Only needed for the demo data script |

## Run the project locally

```bash
npm run dev
```

The API runs on http://localhost:8000.

To test Stripe webhooks on your computer, install the Stripe CLI and run:

```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
```

Put the `whsec_` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it when files change |
| `npm start` | Starts the API |
| `npm run make-admin -- someone@example.com` | Makes an existing account an admin. Admin accounts can never be created through sign up. |
| `npm run seed:demo` | Signs up 4 demo vendors through the real sign-up API and creates 12 demo services through the real API, with photos uploaded to ImgBB. Safe to run again. |
