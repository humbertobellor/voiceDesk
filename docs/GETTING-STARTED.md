<!-- generated-by: gsd-doc-writer -->

# Getting Started with Koolable

This guide will help you set up Koolable for local development and run your first incoming call test.

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js >= 18.0.0** — Check with `node --version`
- **npm** — Included with Node.js; check with `npm --version`
- **Git** — For cloning the repository
- **Supabase CLI** — For local database development (`npm install -g supabase`)

### System Requirements

- macOS, Linux, or Windows (WSL2)
- At least 2 GB free disk space
- A Vercel account (for production deployment — optional for local dev)

### Required External Accounts

Before you start, you'll need accounts with these services:

1. **Supabase** (https://supabase.com) — Database and authentication
2. **Retell AI** (https://www.retellai.com) — Voice AI platform
3. **Twilio** (https://www.twilio.com) — Phone numbers and SMS/WhatsApp
4. **OpenAI** (https://platform.openai.com) — Intent classification (GPT-4o-mini)
5. **Google Cloud Console** (https://console.cloud.google.com) — OAuth for Google Calendar
6. **Inngest** (https://www.inngest.com) — Background jobs (optional for initial setup)

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/koolable.git
cd koolable
```

Replace `https://github.com/your-org/koolable.git` with the actual repository URL.

### 2. Install Dependencies

```bash
npm install
```

This installs all Node.js dependencies listed in `package.json`.

### 3. Copy the Environment Variables File

```bash
cp .env.example .env.local
```

This creates a `.env.local` file with placeholder values. **Never commit `.env.local` to git** — it contains secrets.

### 4. Configure Supabase Credentials

Edit `.env.local` and fill in your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OAUTH_ENCRYPTION_KEY=your-64-character-hex-string
```

To find these values:
1. Go to [Supabase Dashboard](https://app.supabase.com) and select your project
2. Click **Settings** → **API** and copy the `Project URL` and `anon public key`
3. For the service role key: **Settings** → **API** and find the `service_role` key
4. Generate `OAUTH_ENCRYPTION_KEY` with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 5. Configure the App URL

Set `APP_URL` to your local development URL:

```bash
APP_URL=https://xxxx.ngrok-free.app
```

For local testing, use [ngrok](https://ngrok.com) to create a public tunnel:

```bash
# In a separate terminal
ngrok http 3000
```

Copy the forwarding URL (e.g., `https://xxxx.ngrok-free.app`) and set it as `APP_URL`.

### 6. Configure Service Credentials

Fill in the remaining required keys in `.env.local`:

| Variable | Source |
|----------|--------|
| `RETELL_API_KEY` | Retell Dashboard → Account Settings → API Key |
| `RETELL_WEBHOOK_KEY` | Retell Dashboard → API Keys (look for "webhook" badge) |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) → Create new secret key |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client IDs |
| `GOOGLE_REDIRECT_URI` | Set to `{APP_URL}/api/auth/google/callback` (e.g., `https://xxxx.ngrok-free.app/api/auth/google/callback`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |

### 7. Initialize the Database

Start the local Supabase stack:

```bash
supabase start
```

This downloads and starts PostgreSQL, the Supabase API, and Auth UI on your machine. On first run, this takes 2–3 minutes.

You should see:

```
Started supabase local development setup.

API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
```

In another terminal, push the database schema:

```bash
supabase db push
```

This applies all migrations from `supabase/migrations/` to your local PostgreSQL database. You should see output listing each migration applied.

**Verify the database:** Open [Supabase Studio](http://localhost:54323) in your browser. You should see tables: `contractors`, `agents`, `calls`, `leads`, `webhook_events`, and others.

## First Run

### Start the Development Server

In a new terminal (keep `supabase start` and `ngrok http 3000` running):

```bash
npm run dev
```

This starts the Next.js development server on `http://localhost:3000`.

### Create Your Account

1. Open `http://localhost:3000` in your browser
2. Click **Sign Up**
3. Enter your email and a password
4. You should receive a confirmation email in the Supabase Inbucket (http://localhost:54324)
5. Click the link or copy the confirmation code
6. You're now logged in

### Configure Your Contractor Profile

1. Click **Settings** in the dashboard
2. Enter your **business name**, **service type** (HVAC/Plumbing/Electrical), and **phone number**
3. Click **Save Profile**

This creates a `contractors` record in your local database linked to your auth user.

## Provisioning a Twilio Number and Retell Agent

This workflow demonstrates the core AI answering system.

### Step 1: Create a Retell Agent (Manually)

Because agent provisioning typically happens via the UI (not yet built), we'll create an agent in Retell manually:

1. Go to [Retell Dashboard](https://dashboard.retell.ai) and log in with your Retell account
2. Click **Create Agent** and choose **Template: General Receptionist**
3. Set these fields:
   - **Agent Name:** `MyBusiness-Dev`
   - **Language Model:** `GPT-4o` or `GPT-4o-mini`
   - **Language:** English (or Spanish/Creole if testing)
   - **Voice:** Pick any voice (e.g., "Lily")
4. Click **Create** and copy the **Agent ID** (starts with `agent_...`)
5. Add it to `.env.local`:
   ```bash
   RETELL_AGENT_ID=agent_xxxxx
   ```

### Step 2: Create a Twilio Phone Number

1. Go to [Twilio Console](https://console.twilio.com) and log in
2. Click **Phone Numbers** → **Buy a Number**
3. Search for a number in your area (any US number works for dev)
4. Purchase it
5. Go to **Phone Numbers** → **Manage** → Select your number
6. Under **Voice & Fax**, set the webhook:
   - **When a call comes in:** Webhook, `{APP_URL}/api/webhooks/retell` (e.g., `https://xxxx.ngrok-free.app/api/webhooks/retell`)
   - Method: `POST`
7. Click **Save**
8. Copy your Twilio phone number (e.g., `+1234567890`) and add it to `.env.local`:
   ```bash
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### Step 3: Test an Incoming Call

1. From your mobile phone, call the Twilio number you just created
2. Retell AI should answer with a greeting
3. Speak naturally — the agent will ask about your service needs
4. The call will end and a `calls` record will be created in Supabase

**Verify the webhook was received:**
- Check Supabase Studio: Tables → `calls` — you should see a new row
- Check the development server logs: you should see `Received Retell webhook` message

## Common Setup Issues and Troubleshooting

### "ngrok tunnel rejected" or "Invalid APP_URL"

**Problem:** The Retell webhook cannot reach your ngrok URL.

**Solution:**
- Verify ngrok is still running (`ngrok http 3000` in a separate terminal)
- Confirm `APP_URL` in `.env.local` matches the ngrok forwarding URL (without trailing slash)
- Restart the dev server after changing `APP_URL`

### "Service role key is invalid" or database connection fails

**Problem:** Supabase credentials are incorrect.

**Solution:**
- Copy credentials directly from Supabase Studio (http://localhost:54323)
- Ensure you're using the **service role key**, not the public anon key, for `SUPABASE_SERVICE_ROLE_KEY`
- Confirm `.env.local` is in the project root, not in `src/`

### Supabase CLI not found

**Problem:** `supabase` command returns "not found".

**Solution:**
```bash
npm install -g supabase
supabase --version  # Should print version number
```

### Next.js dev server shows TypeScript errors

**Problem:** `npm run dev` fails with type errors.

**Solution:**
- Run `npm run typecheck` to see all type issues
- Ensure `OAUTH_ENCRYPTION_KEY` is a 64-character hex string (see Step 4 above)
- If errors persist, try clearing cache:
  ```bash
  rm -rf .next
  npm run dev
  ```

### "Failed to connect to PostgreSQL" after `supabase start`

**Problem:** The local database isn't responding.

**Solution:**
- Stop Supabase and restart:
  ```bash
  supabase stop
  supabase start
  ```
- If port 54322 is already in use, kill the process:
  ```bash
  lsof -i :54322  # macOS/Linux
  # Kill the PID shown
  ```

### Retell webhook returns 500 error

**Problem:** Incoming calls fail with HTTP 500.

**Solution:**
- Verify `RETELL_WEBHOOK_KEY` is set in `.env.local` (must match Retell dashboard)
- Confirm `APP_URL` is reachable by Retell (check ngrok is forwarding to `localhost:3000`)
- Check server logs for the actual error: look for `Error verifying Retell signature`

### "Google OAuth credentials are invalid"

**Problem:** Cannot authenticate with Google Calendar API.

**Solution:**
- Double-check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console
- Ensure `GOOGLE_REDIRECT_URI` matches the **Authorized redirect URIs** in your OAuth app settings
- URI format must be exact: `https://your-app.vercel.app/api/auth/google/callback`

## Next Steps

Once your local setup is complete and you've tested your first incoming call, explore:

1. **[DEVELOPMENT.md](DEVELOPMENT.md)** — Build commands, code style, and linting setup
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, component diagram, and data flow
3. **[CONFIGURATION.md](CONFIGURATION.md)** — All environment variables and their purposes
4. **[TESTING.md](TESTING.md)** — Unit tests, integration tests, and running Playwright E2E tests

### Important Notes for Continued Development

- **Database migrations:** Always write migrations in `supabase/migrations/` (timestamp-prefixed SQL files). Run `supabase db push` to apply them.
- **Environment variables:** Use `NEXT_PUBLIC_*` only for browser-safe values. Server-side secrets (API keys, tokens) must NOT have the `NEXT_PUBLIC_` prefix.
- **Webhooks:** Retell, Twilio, and other services send webhooks to your `APP_URL`. Use ngrok while developing; switch to your Vercel URL when deploying.
- **Secrets in `.env.local`:** Never commit this file. The CI/CD pipeline uses Vercel's environment variable settings.
