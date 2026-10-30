# Car Comfort Backend

Node.js + Express + Sequelize (MySQL) backend for a service marketplace app.

## Setup

1. Install deps:
   - `npm install`
2. Create `.env` from `.env.example` and update **local** DB credentials.
3. Create DB in MySQL (example):
   - `CREATE DATABASE car_comfort;`
4. Run migrations:
   - `npm run db:migrate`
5. Start server:
   - `npm run dev`

## Email triggers (Welcome + onboarding lifecycle)

The backend sends these emails (SMTP via `MAIL_*` vars; otherwise it logs a mock email to console):

- **Customer**: after OTP verification → **Welcome email**
- **Driver**: after registration → **Welcome email with onboarding steps**
- **Driver**: after completing onboarding + verifying OTP → **Thank you for completing profile**
- **Driver**: after admin approval → **Approved email**
- **Driver**: after admin rejection (with reason) → **Rejected email**

Send-once behavior is stored in `users.profile.email_events` so retries won’t duplicate emails.

### Admin review API (approve / reject drivers)

These endpoints require `Authorization: Bearer <admin_token>`:

- `POST /api/admin/drivers/:userId/approve`
- `POST /api/admin/drivers/:userId/reject` with JSON body: `{ "reason": "..." }`

## Environments (development vs production)

This app loads environment variables in this order:

- `.env.<NODE_ENV>` (example: `.env.production`) if it exists
- `.env` (fallback)
- Existing server environment variables always win (dotenv does not override by default)

### Production deployment

On your production server, set:

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

You can either:

- Set them via your process manager (recommended), or
- Create a `.env.production` on the server using `.env.production.example` as a template

Health check:
- `GET /health`

