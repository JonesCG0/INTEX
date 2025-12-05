# INTEX
Section 1.8  
SuitsOTLoose (Carson Jones, Merrick Morgan, Cameron Webb, Tobin Whitworth)

## Access
- Public site: https://jonescg0.net/
- **Default admin credentials** – Username `admin`, password `adminaccountpassword`
- **Default participant credentials** – Username `user`, password `useraccountpassword`
- Once authenticated, every data tool is available from the navigation bar.

## Overview
INTEX is a full-stack Node.js + Express application that helps program administrators recruit participants, run events, collect surveys, and raise money. The public landing/support pages highlight impact stats and capture online donations, while authenticated staff receive role-aware tooling for users, participants, events, registrations, surveys, milestones, and media.

## Feature Highlights
### Public Experience
- Landing page cards pull live counts (participants, events, milestones, donation total) from PostgreSQL using resilient helper queries.
- `/support` exposes a secure donation form. Submissions sanitize every field, store transactional metadata in the `support_donations` table (auto-created if missing), and reuse or create donor accounts through `utils/donationService.js`.
- Donors with an email receive receipts sent by `utils/mailer.js`, which automatically switches between your SMTP credentials and an Ethereal test inbox during development.
- Easter eggs: typing `teapot`, `dom`, `redundancy`, `tableau`, `chopped`, or `rick` anywhere on the page triggers the themed views hidden in `public/*.js` and `routes/public.js`.

### Participant Workflow
- `/auth/signup` validates and sanitizes every onboarding field (names, DOB, guardian contact, address, etc.) before hashing passwords via Bcrypt.
- `/registrations` lets participants browse future events, respects registration deadlines/capacity, prevents duplicates, and exposes a history of confirmed events.
- Surveys unlock only after someone attended an event and no prior survey exists; overall scores are computed automatically and exposed to admins.
- `/profile` allows users to edit contact info, guardian data, interest fields, and upload photos stored in S3 (with graceful skip when credentials are absent).

### Admin Workspace
- `/dashboard` aggregates administrative actions behind the `requireAdmin` middleware, piggy-backing on the custom `middleware/flash` helper for inline success/error toasts.
- `/users` provides image uploads (Multer + S3), password resets, role toggles, and cascaded deletion through `utils/userCleanup.js`, which removes dependent registrations, surveys, milestones, and donations transactionally.
- `/participants`, `/events`, `/milestones`, `/donations`, and `/surveys` each implement full CRUD with consistent sanitizers (`utils/validators.js`), datetime helpers, search/sort controls, and server-side validation messages.
- Admins can register participants for events without logging into those accounts using the AJAX endpoints `/registrations/admin/search-users`, `/registrations/admin/search-events`, and `/registrations/admin/register`.
- Table-heavy pages load `public/table-controls.js` for client-side filtering, pagination, empty states, and adjustable page sizes without pulling in a full data-grid dependency.

### Automations & Services
- `utils/donationService.js` ensures every donation has a user: it finds by email, builds a support user with a random password, or falls back to the anonymous donor configured in `ANONYMOUS_DONOR_USERID`.
- `utils/mailer.js` centralizes email sending, infers SMTP configuration from multiple env var names (`EMAIL_*` or `SMTP_*`), memoizes transports, and exposes `isUsingTestEmail()` for debugging.
- `scripts/hashPasswords.js` (`npm run migrate:passwords`) migrates legacy plaintext passwords to Bcrypt hashes, skipping already-hashed accounts.
- `sql/fix_donation_sequence.sql` is provided to repair donor ID sequences if bulk imports bypassed the default.
- `src/component/LogoLoop.jsx` (with `LogoLoop.css`) is a reusable React marquee component we drop into marketing surfaces to animate sponsor logos.

### Front-End Extras
- `public/table-controls.js` is data-attribute driven (`data-table-id`, `data-search-for`, `data-page-size-for`, `data-pagination-for`) so any EJS table immediately receives instant search and pagination.
- Static JS files such as `dom.js`, `redundancy.js`, `tableau.js`, `chopped.js`, and `rick.js` listen globally for the secret keyword and redirect to their routes.
- `public/styles.css` centralizes shared UI styles, button states, nav tweaks, and grid layouts for the dashboard stat cards.

## Tech Stack
- **Runtime / Framework:** Node.js 18+, Express 4, EJS views, custom middleware
- **Database:** PostgreSQL queried through Knex with pooled connections
- **Authentication:** express-session cookies, role guards, custom flash messages
- **Storage & Media:** AWS S3 via `@aws-sdk/client-s3` with Multer in-memory uploads
- **Email:** Nodemailer transport with Ethereal fallback for local development
- **Utilities:** Bcrypt for password hashing, custom validators, donation/user helper services, lightweight client-side table controller

## Application Map
| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing hero + live stats |
| `/support`, `/support/donate` | Public | Donation form, metadata capture, thank-you emails |
| `/auth/login`, `/auth/logout` | Public | Session-backed login/logout |
| `/auth/signup` | Public | Participant onboarding with full validation |
| `/dashboard` | Admin | Entry point for staff-only modules |
| `/users` | Admin | Manage internal user accounts, roles, S3 photos |
| `/participants` | Admin | CRUD for participant profiles with DOB formatting |
| `/events` | Auth, admin for create/edit/delete | Template-aware event occurrences with location/capacity data |
| `/registrations` | Auth; admin endpoints under `/registrations/admin/*` | Self-serve registrations, admin quick register/unregister, survey gating |
| `/surveys` | Auth (view), Admin (detail/edit/delete) | Aggregate event feedback and edit 1–5 scores |
| `/donations` | Auth (view), Admin (mutations) | Internal ledger, manual donation entry, FK cleanup |
| `/milestones` | Auth (view), Admin (mutations) | Track major participant or program milestones |
| `/profile` | Auth | Personal profile editor + avatar upload |
| `/teapot`, `/dom`, `/redundancy`, `/tableau`, `/chopped`, `/rick` | Public | Easter-egg pages referenced by the secret key listeners |

## Project Structure (high level)
```
controllers/     # Thin wrappers for donation/event/milestone query helpers
routes/          # Express routers (auth, users, participants, events, donations, surveys, registrations, profile, public, dashboard)
views/           # EJS templates for public + authenticated pages
public/          # CSS, favicon, easter-egg JS, table-controls, etc.
middleware/      # Authentication + session flash helpers
utils/           # Validators, mailer, donation service, password helpers, user cleanup, participant model mapping
scripts/         # hashPasswords + testEmail scripts
sql/             # SQL snippets (e.g., sequence fixes)
src/component/   # LogoLoop React component used on marketing sections
```

## Getting Started
### Prerequisites
1. Node.js 18+ and npm
2. PostgreSQL 13+ available locally or remotely
3. AWS credentials with write access to the `S3_BUCKET` (optional in dev)
4. SMTP credentials (or rely on the Ethereal test inbox that Nodemailer provisions automatically)

### Installation
```bash
git clone <repo-url>
cd INTEX
npm install
```

### Environment Variables
Create a `.env` in the project root:

| Variable | Description |
| --- | --- |
| `PORT` | Port for the HTTP server (defaults to `3000`). |
| `SESSION_SECRET` | Required for signing session cookies and flash messages. |
| `STATIC_BASE_URL` | Optional CDN/S3 base used in templates; falls back to `https://<S3_BUCKET>.s3.<AWS_REGION>.amazonaws.com/static`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` | PostgreSQL connection info read by `knexfile.js`. |
| `S3_BUCKET`, `AWS_REGION` | Image upload destination. When unset, uploads are skipped (dev-friendly). |
| `ANONYMOUS_DONOR_USERID` | Backstop user ID linked to donations without email addresses. Must exist in the `users` table. |
| `BCRYPT_ROUNDS` | Optional override for hashing cost (defaults to 10, min 4, max 15). |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE` | SMTP host details (may also be provided as `SMTP_*`). |
| `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP auth + default sender (also supports `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`). |
| `TEST_EMAIL_TO` | Optional default address used by the test-email script. |

> Pro tip: copy a sanitized `.env` template into 1Password or Bitwarden and rotate the `SESSION_SECRET` outside of Git.

### Database & Data
1. Create the Postgres database referenced in `.env`.
2. Run your schema/migrations/import scripts. The `sql/fix_donation_sequence.sql` helper resets the donation sequence if needed.
3. Seed a user that will act as `ANONYMOUS_DONOR_USERID` (or update the config in `config/donations.js`).
4. Run `npm run migrate:passwords` after importing legacy data so that plaintext passwords are converted to bcrypt hashes.
5. The first donation automatically creates the `support_donations` metadata table if it does not exist, so ensure the DB user has `CREATE TABLE` rights.

## Running the App
```bash
# Development with Nodemon auto-reload
npm run dev

# Production-style start
npm start
```
Your app is now reachable at `http://localhost:<PORT>`. Static assets are served from `public/`, and views live in `views/`.

## Scripts & Tooling
- `npm run dev` – Nodemon-powered development server.
- `npm start` – Plain Node start (used in production).
- `npm run test:email` – Invokes `scripts/testEmail.js` to send a smoke-test email to `TEST_EMAIL_TO` or a CLI argument.
- `npm run migrate:passwords` – Runs `scripts/hashPasswords.js` to backfill bcrypt hashes (skips already hashed users, logs stats).
- `node scripts/testEmail.js <recipient>` – Manual variant of the email test script for ad-hoc addresses.
- `sql/fix_donation_sequence.sql` – One-off helper to realign donation sequences after CSV imports.

## Table Controls Quickstart
Attach the `data-*` attributes shown below and include `table-controls.js` (already loaded globally):

```html
<input class="form-control" placeholder="Search participants" data-search-for="participantsTable" />
<select data-page-size-for="participantsTable">
  <option value="10">10</option>
  <option value="20" selected>20</option>
  <option value="50">50</option>
</select>

<table class="table" data-table-id="participantsTable">
  <!-- table head + body -->
</table>

<nav>
  <ul class="pagination" data-pagination-for="participantsTable"></ul>
</nav>
```
The helper handles page counts, Prev/Next controls, empty states, and live filtering without any backend changes.

## Easter Eggs & Extras
- `public/dom.js`, `redundancy.js`, `tableau.js`, `chopped.js`, and `rick.js` listen for their respective keywords and redirect to `/dom`, `/redundancy`, `/tableau`, `/chopped`, and `/rick`.
- `public/teapot.js` and the `/teapot` route return HTTP 418 with a custom page when the `teapot` keyword is typed.
- `src/component/LogoLoop.jsx` + `LogoLoop.css` provide the animated sponsor strip; import the component into any React page or embed the compiled output on marketing edges.

## Dropbox Link
- https://www.dropbox.com/scl/fo/52y50oqgfnt5i7dse85se/AN-VkqZcxctwXvzFfh5ueIg?rlkey=rhnmhbxdestfzmbsik6ajos53&st=mn45ay59&dl=0

## Support & Questions
Run into setup trouble or notice a bug? Open an issue or reach out to the INTEX dev team with environment details, repro steps, and relevant logs/screenshots so we can help quickly.

