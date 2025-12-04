# INTEX

INTEX is a Node.js + Express web application that helps program administrators manage participants, events, registrations, surveys, milestones, and fundraising activity. Authenticated staff members get a full dashboard to organize data, while the public landing and support pages highlight program impact and capture online donations.

## Features
- **Role-based dashboard** - Secure session-backed authentication keeps admin-only routes such as `/users`, `/participants`, `/registrations`, `/surveys`, and `/milestones` behind the `requireAuth` middleware.
- **Event & registration management** - Create, edit, and monitor events and participant registrations with searchable, sortable tables rendered via EJS templates.
- **Survey insights** - Collect satisfaction/usefulness responses per event and display detailed scorecards for each survey submission.
- **Donation tracking** - Accept public "support" donations, persist donor metadata, send confirmation emails, and expose an internal donations module for admins.
- **Milestone timeline** - Record key milestones for quick status reporting on the landing page.
- **Profile & media uploads** - Users can update their profile information, including photo uploads that are persisted to Amazon S3.

## Tech Stack
- **Runtime / Framework:** Node.js, Express, EJS
- **Database:** PostgreSQL via Knex
- **Auth & Sessions:** express-session with cookie-based sessions
- **File storage:** AWS S3 (via `@aws-sdk/client-s3`)
- **Email:** Nodemailer (SMTP transport)
- **Other utilities:** Multer for uploads, Bcrypt for password hashing, custom validators in `utils/`

## Getting Started

### Prerequisites
1. Node.js 18+ and npm installed locally.
2. PostgreSQL 13+ running locally or accessible remotely.
3. AWS credentials with access to the bucket defined in `S3_BUCKET`.
4. SMTP credentials (Gmail or another provider) for transactional emails.

### Installation
```bash
git clone <repo-url>
cd INTEX
npm install
```

### Environment Variables
Create a `.env` file in the project root. The following variables are read at runtime:

| Variable | Description |
| --- | --- |
| `PORT` | Port the Express server should bind to (defaults to `3000`). |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` | PostgreSQL connection settings used by Knex. |
| `SESSION_SECRET` | Secret used to sign session cookies. |
| `S3_BUCKET`, `AWS_REGION` | Bucket name and AWS region for storing profile photos. Credentials are loaded from your AWS environment/profile. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE` | SMTP host details for Nodemailer. |
| `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP authentication info and default "from" address. |
| `TEST_EMAIL_TO` | Optional helper address used by `npm run test:email`. |

> Never commit real credentials; use `.env.example` style files or environment-specific secrets stores.

### Database
1. Create the target database defined in your `.env`.
2. Apply the schema using your preferred tooling. The `sql/` directory contains helper scripts (e.g., `fix_donation_sequence.sql`) and can be adapted for initial imports.
3. If migrating legacy passwords, run `npm run migrate:passwords` after the data is in place.

## Running the App
```bash
# Start with auto-reload (development)
npm run dev

# Production-style start
npm start
```
The server will be available at `http://localhost:<PORT>`. Static assets live in `public/`, and EJS views reside under `views/`.

## Useful Scripts
- `npm run dev` - Start the Express server with Nodemon.
- `npm start` - Start the server without live reload.
- `npm run test:email` - Sends a test message using the configured SMTP credentials (reads `TEST_EMAIL_TO`).
- `npm run migrate:passwords` - Hashes plaintext user passwords using Bcrypt. Run after importing historical user records.

## Project Structure (high level)
```
controllers/    # Legacy controller helpers (some routes call directly into db/)
routes/         # Express routers for auth, users, events, donations, etc.
views/          # EJS templates for public and authenticated pages
public/         # Static assets (css, js, images)
utils/          # Mailer, S3 helpers, validation utilities, donation service
middleware/     # Authentication middleware (requireAuth)
scripts/        # One-off maintenance scripts (email test, password migration)
sql/            # SQL helpers/snippets for DB fixes
```

## Development Tips
- Use `npm run dev` while iterating so Nodemon restarts on file changes.
- Keep your `.env` synced with teammates using a secret manager instead of committing it.
- When working on database changes, prefer Knex migrations or versioned SQL scripts under `sql/` to keep environments reproducible.
- The landing page stats and donation flows rely on aggregate queries; ensure your local database has sample data so UI cards render correctly.

## Support & Questions
If you run into setup issues or find a bug, open an issue or contact the INTEX dev team with details about your environment, steps to reproduce, and any relevant logs.

