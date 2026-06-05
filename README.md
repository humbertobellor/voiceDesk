<!-- generated-by: gsd-doc-writer -->

# Koolable

24/7 AI phone receptionist SaaS for HVAC, plumbing, and electrical contractors. Answers missed calls via Retell voice AI, qualifies leads, books appointments to Google Calendar, and dispatches emergencies via WhatsApp/Telegram/SMS.

## Features

- **Voice AI answering** — Retell AI handles incoming calls in English, Spanish, and Haitian Creole
- **Lead qualification** — GPT-4o intent classification and data capture
- **Calendar integration** — Books appointments directly to Google Calendar
- **Multi-channel notifications** — SMS, WhatsApp, and Telegram for emergencies and confirmations
- **Call recording & analytics** — Full call logs, recordings, and lead tracking
- **Subscription billing** — Stripe-integrated per-tier pricing (Basic / Professional / Enterprise)
- **Contractor portal** — Dashboard for call history, agent configuration, and settings

## Stack

| Layer | Technology |
|-------|------------|
| Voice AI | Retell AI (v2 SDK) |
| Telephony | Twilio (SDK v5) |
| Database + Auth | Supabase (`@supabase/ssr`) |
| Framework | Next.js 14 (App Router, TypeScript) |
| Hosting | Vercel |
| Billing | Stripe Checkout + webhooks |
| Calendar | Google Calendar API |
| Notifications | Twilio WhatsApp + SMS, grammY (Telegram) |
| Background jobs | Inngest |
| UI | React 19, Tailwind CSS, Radix UI |

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm (or pnpm/yarn)
- Vercel account (for deployment)
- Supabase account (for database)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/koolable.git
cd koolable

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure required secrets in .env.local:
# - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# - RETELL_API_KEY, RETELL_WEBHOOK_KEY
# - OPENAI_API_KEY
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
# - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
# - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_*_PLAN_ID
# - INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
```

## Quick Start

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser

# Log in with your Supabase credentials
# Navigate to the dashboard to provision a Retell agent
```

## Usage

### Provisioning a Contractor Agent

1. Sign up or log in to the Koolable dashboard
2. Go to **Settings** → **Provision Agent**
3. Select your service type (HVAC, Plumbing, Electrical)
4. Confirm your phone number and calendar (Google Calendar)
5. Koolable assigns you a Twilio number and creates a Retell agent
6. Calls to that number are answered by the AI agent 24/7

### Viewing Call Records

1. Go to **Dashboard** → **Call Log**
2. Filter by date, service type, or outcome
3. Listen to recordings, view lead data, or manually edit notes

### Connecting WhatsApp/Telegram

1. Go to **Settings** → **Notifications**
2. Choose WhatsApp, SMS, or Telegram
3. Scan the QR code or click the link to connect your chat app
4. Confirm that emergency alerts are enabled

## Development

For detailed development setup, testing, and architecture information, see:

- [GETTING-STARTED.md](docs/GETTING-STARTED.md) — Prerequisites and first run
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — Local dev setup, build commands, code style
- [TESTING.md](docs/TESTING.md) — Test framework and running tests
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design and component overview

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm start` — Start production server
- `npm run lint` — Run ESLint
- `npm run typecheck` — Run TypeScript type checking
- `npm run test` — Run unit tests (Vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:e2e` — Run end-to-end tests (Playwright)

## Configuration

All configuration is environment-variable driven. See `.env.example` for the complete list.

Key variables:
- `APP_URL` — Public Vercel URL (used for Retell webhook registration)
- `RETELL_API_KEY` — Retell AI API key
- `GOOGLE_CLIENT_ID/SECRET` — Google OAuth credentials
- `STRIPE_*_PLAN_ID` — Stripe pricing plan IDs

For full configuration details, see [CONFIGURATION.md](docs/CONFIGURATION.md).

## Deployment

Koolable deploys to Vercel on every push to `main`. Environment secrets are configured in Vercel project settings.

For deployment instructions, see [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

Proprietary. All rights reserved.
