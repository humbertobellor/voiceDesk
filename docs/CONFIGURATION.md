<!-- generated-by: gsd-doc-writer -->

# Configuration

Koolable requires configuration of environment variables and third-party service integrations across six major platforms: Supabase (database and auth), Retell AI (voice), Twilio (SMS/WhatsApp), Google OAuth (calendar), Stripe (billing), and Inngest (background jobs).

## Environment Variables

All environment variables are defined in `.env.example`. Copy this file to `.env.local` (development) or configure them in your deployment platform (Vercel).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Supabase** |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | — | Supabase project URL (e.g., `https://your-project.supabase.co`). Find in Supabase Dashboard → Settings → API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase public anon key (client-safe). Find in Supabase Dashboard → Settings → API → anon public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key (server-only secret). Find in Supabase Dashboard → Settings → API → service_role secret. **CRITICAL: Never prefix with `NEXT_PUBLIC_` — this must never reach the browser.** |
| `OAUTH_ENCRYPTION_KEY` | Yes | — | 32-byte encryption key for Google OAuth tokens at rest (Phase 4 onwards). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Must be 64 hex characters. |
| **Retell AI** |
| `RETELL_API_KEY` | Yes | — | Retell API key for creating and updating voice agents. Find in Retell Dashboard → API Keys. |
| `RETELL_WEBHOOK_KEY` | Yes | — | Retell webhook signing key (separate from REST API key). Find in Retell Dashboard → API Keys → the key marked with a "webhook" badge. Used to verify HMAC-SHA256 signatures on incoming webhook events (call_ended, call_analyzed). Without this, webhook handler returns 500. **Never prefix with `NEXT_PUBLIC_`.** |
| **Application** |
| `APP_URL` | Yes | — | Public URL where the application is deployed (no trailing slash). Used to register webhook callbacks with Retell and Telegram. Examples: `https://your-app.vercel.app` (production) or `https://xxxx.ngrok-free.app` (local tunneling). Required for provisioning phase. |
| **OpenAI (Intent Classification)** |
| `OPENAI_API_KEY` | Yes (Phase 3+) | — | OpenAI API key for intent classification and call analysis (Phase 3 onwards). Find at https://platform.openai.com/api-keys. Uses GPT-4o-mini and GPT-4o. **Never prefix with `NEXT_PUBLIC_`.** |
| **Google Calendar OAuth** |
| `GOOGLE_CLIENT_ID` | Yes (Phase 4+) | — | Google OAuth 2.0 Client ID for scheduling. Find in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs (Web application). |
| `GOOGLE_CLIENT_SECRET` | Yes (Phase 4+) | — | Google OAuth 2.0 Client Secret. Find in Google Cloud Console → APIs & Services → Credentials. **Never prefix with `NEXT_PUBLIC_`.** |
| `GOOGLE_REDIRECT_URI` | Yes (Phase 4+) | — | Must match the Authorized redirect URI configured in Google Cloud Console. Format: `https://your-app.vercel.app/api/auth/google/callback`. This exact value must be registered in the OAuth app. |
| **Twilio SMS + WhatsApp** |
| `TWILIO_ACCOUNT_SID` | Yes (Phase 5+) | — | Twilio account SID for SMS and WhatsApp. Find in Twilio Console → Account Info panel. **Never prefix with `NEXT_PUBLIC_`.** |
| `TWILIO_AUTH_TOKEN` | Yes (Phase 5+) | — | Twilio auth token. Find in Twilio Console → Account Info panel. **Never prefix with `NEXT_PUBLIC_`.** |
| `TWILIO_FROM_NUMBER` | Yes (Phase 5+) | — | Twilio phone number for outbound SMS (E.164 format: `+1XXXXXXXXXX`). Find in Twilio Console → Phone Numbers → Manage → Active Numbers. |
| `TWILIO_WHATSAPP_FROM` | Yes (Phase 5+) | — | WhatsApp sender number (WABA-approved). Format: `whatsapp:+1XXXXXXXXXX`. Find in Twilio Console → Messaging → Senders → WhatsApp Senders. Requires WhatsApp Business Account registration and WABA approval (3–7 business days). |
| `TWILIO_WHATSAPP_SID_NEW_LEAD` | Yes (Phase 5+) | — | Content SID for "voicedesk_new_lead" WhatsApp template. Format: `HX...`. Find in Twilio Console → Messaging → Content Template Builder. Set only after WABA approval. |
| `TWILIO_WHATSAPP_SID_EMERGENCY` | Yes (Phase 5+) | — | Content SID for "voicedesk_emergency" WhatsApp template. Format: `HX...`. Set only after WABA approval. |
| **Telegram Bot** |
| `TELEGRAM_BOT_TOKEN` | Yes (Phase 5+) | — | Telegram Bot API token. Create via Telegram → @BotFather → /newbot (username: VoiceDeskBot) → copy token. **Never prefix with `NEXT_PUBLIC_`.** |
| `TELEGRAM_WEBHOOK_SECRET` | Yes (Phase 5+) | — | Random secret for Telegram webhook validation (prevents unauthorized POST to `/api/webhooks/telegram`). Generate: `openssl rand -hex 32`. Must be passed to Telegram's `setWebhook` call. **Never prefix with `NEXT_PUBLIC_`.** |
| `TELEGRAM_WEBHOOK_URL` | Yes (Phase 5+) | — | Full HTTPS URL where Telegram sends webhook updates. Must point to `/api/webhooks/telegram`. Format: `https://your-app.vercel.app/api/webhooks/telegram`. For local testing, use ngrok: `https://xxxx.ngrok-free.app/api/webhooks/telegram`. **Never prefix with `NEXT_PUBLIC_`.** |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Yes (Phase 5+) | — | Telegram bot username (without `@`). Used to generate deep-link URLs in the NotificationSettingsForm. Must be set at build time — if unset, deep-links will be broken (empty username). **This is the only Telegram variable that is `NEXT_PUBLIC_` (safe to expose).** |
| **Stripe (Billing)** |
| `STRIPE_SECRET_KEY` | Yes (Phase 7+) | — | Stripe secret API key. Find in Stripe Dashboard → Developers → API keys → Secret key. Format: `sk_live_...` or `sk_test_...`. **Never prefix with `NEXT_PUBLIC_`.** |
| `STRIPE_WEBHOOK_SECRET` | Yes (Phase 7+) | — | Stripe webhook signing secret. Find in Stripe Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret. Format: `whsec_...`. **Never prefix with `NEXT_PUBLIC_`.** |
| `STRIPE_BASIC_PLAN_ID` | Yes (Phase 7+) | — | Price ID for Basic plan ($299/mo). Find in Stripe Dashboard → Products → Basic → Copy price ID. |
| `STRIPE_PROFESSIONAL_PLAN_ID` | Yes (Phase 7+) | — | Price ID for Professional plan ($499/mo). Find in Stripe Dashboard → Products → Professional → Copy price ID. |
| `STRIPE_ENTERPRISE_PLAN_ID` | Yes (Phase 7+) | — | Price ID for Enterprise plan ($799/mo). Find in Stripe Dashboard → Products → Enterprise → Copy price ID. |
| **Inngest (Background Jobs)** |
| `INNGEST_EVENT_KEY` | Yes (Phase 2+) | — | Inngest Event API key. Find in Inngest Dashboard → Settings → Event Keys. Used to enqueue background jobs. |
| `INNGEST_SIGNING_KEY` | Yes (Phase 2+) | — | Inngest webhook signing key. Find in Inngest Dashboard → Settings → Signing Keys. Used to verify Inngest webhook callbacks. **Never prefix with `NEXT_PUBLIC_`.** |

## Local Development Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in required values for your current phase:**
   - **Phase 1 (Foundation):** Supabase variables only
   - **Phase 2 (Provisioning):** Add Retell + Inngest + `APP_URL`
   - **Phase 3 (Webhook Core):** Add OpenAI
   - **Phase 4 (Scheduling):** Add Google OAuth variables
   - **Phase 5 (Notifications):** Add Twilio + Telegram
   - **Phase 7 (Billing):** Add Stripe

3. **For local testing, use ngrok for `APP_URL`:**
   ```bash
   ngrok http 3000
   # Copy the HTTPS URL: https://xxxx.ngrok-free.app
   # Set: APP_URL=https://xxxx.ngrok-free.app
   ```

4. **Start the dev server:**
   ```bash
   npm run dev
   ```

5. **For RLS testing, configure `.env.test`:**
   ```bash
   cp .env.test.example .env.test
   # Run: npx tsx scripts/seed-rls-test-fixtures.ts
   # Copy the printed JWT and contractor ID values into .env.test
   npm run test
   ```

## Vercel Deployment Environment Variables

Configure environment variables in Vercel Dashboard → Settings → Environment Variables.

All variables from `.env.example` must be set in Vercel **except**:
- `NEXT_PUBLIC_SUPABASE_URL` — can be set in Vercel or inlined at build time
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — can be set in Vercel or inlined at build time

**Important:** Only set production values (e.g., `STRIPE_SECRET_KEY=sk_live_...`) in the `Production` environment. Use `sk_test_...` in Preview/Development environments.

To avoid accidentally deploying test credentials to production:
1. Set variables per environment (Production, Preview, Development)
2. Verify in Vercel Dashboard before each deploy
3. Never use test API keys in production environment

## Supabase Configuration

### Database & Auth

The Supabase project must have:
- **Database:** PostgreSQL 15+
- **Auth:** Email-based authentication enabled (see `supabase/config.toml` for local dev setup)
- **RLS (Row Level Security):** Enabled on all tables

### RLS Policies

**Critical rule (CLAUDE.md):** Every Supabase table must have RLS enabled with all four operation policies (SELECT, INSERT, UPDATE, DELETE) defined, tested as an unprivileged user before deploy.

Policies follow three patterns:

**Pattern A — Direct user_id (contractors table):**
- User can SELECT/INSERT/UPDATE/DELETE only their own contractor record
- Policy: `(SELECT auth.uid()) = user_id`

**Pattern B — Foreign key to contractors (calls, leads, contractor_settings, calendar_tokens, etc.):**
- User can access only records where `contractor_id` belongs to a contractor they own
- Policy: `contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))`

**Pattern C — Webhook events (deny-all):**
- `webhook_events` table denies authenticated and anonymous users all operations
- Service role key bypasses (server-only writes via API routes)
- Policy: `deny_all_authenticated` and `deny_all_anonymous`

Policies are defined in migration: `supabase/migrations/20260504000002_rls_policies.sql`

To test RLS locally:
```bash
npm run test  # Uses .env.test with seeded test user credentials
```

### OAuth Token Encryption

Google OAuth refresh tokens are encrypted at rest using AES-256-GCM:
- **Encryption key:** `OAUTH_ENCRYPTION_KEY` (32 bytes, 64 hex characters)
- **Storage:** Tokens stored in `calendar_tokens.token_encrypted` column
- **Decryption:** Only in server-side code (API routes, Server Components)
- **Generation:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Generate a unique key for each environment (local, staging, production).

## Per-Environment Configuration

### Development
- `NODE_ENV=development` (automatic on `npm run dev`)
- Use local Supabase instance with `supabase start` or connect to a dev Supabase project
- Use test API keys for all services (Retell, Twilio, Stripe, etc.)
- `APP_URL=https://xxxx.ngrok-free.app` (ngrok tunnel for local testing)

### Staging
- <!-- VERIFY: staging-specific environment variables and Supabase project URL -->
- Use staging API keys for all services
- Stripe test mode
- Sentry environment: `staging`

### Production
- `NODE_ENV=production` (automatic on Vercel)
- Use production Supabase project
- Use live API keys for all services
- `APP_URL=https://koolable.com` or your production domain
- Stripe live mode
- <!-- VERIFY: production Sentry environment and error tracking setup -->

## Service Integration Prerequisites

Before using each service, complete the setup steps:

### Retell AI
1. Create account at https://retell.ai
2. Generate API key in Retell Dashboard → API Keys
3. Identify the webhook signing key (marked "webhook" badge)
4. Set `RETELL_API_KEY` and `RETELL_WEBHOOK_KEY`
5. No WABA or external approvals needed for voice

### Google OAuth (Calendar Integration)
1. Create Google Cloud Project at https://console.cloud.google.com
2. Enable Google Calendar API: APIs & Services → Library → search "Google Calendar" → Enable
3. Create OAuth 2.0 Client ID: Credentials → Create Credentials → OAuth 2.0 Client ID → Web application
4. Add Authorized redirect URI: `https://your-app.vercel.app/api/auth/google/callback` (matching your `GOOGLE_REDIRECT_URI`)
5. Copy Client ID and Client Secret
6. <!-- VERIFY: Google OAuth app must be moved to Production mode before Phase 4 ships. CASA Tier 2 security assessment required (3–8 weeks). -->

### Twilio (SMS & WhatsApp)
1. Create Twilio account at https://www.twilio.com
2. Fund account with phone verification
3. Purchase a Twilio phone number: Console → Phone Numbers → Buy a Number
4. Set up WhatsApp Business Account (WABA):
   - <!-- VERIFY: Submit WABA registration and notification templates (voicedesk_new_lead, voicedesk_emergency, voicedesk_payment_failed) via Twilio Console → 3–7 business day approval window. Start in week 1 of build, do not wait until Phase 5. -->
   - Await WABA approval (3–7 business days)
   - Create message templates in Twilio Content Template Builder
   - Copy Content SIDs (`HX...`) for each template
5. Find Account SID and Auth Token in Twilio Console → Account Info
6. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`, and template Content SIDs

### Telegram Bot
1. Open Telegram and search @BotFather
2. Send `/newbot`
3. Follow prompts: set name (e.g., "VoiceDesk") and username (e.g., "VoiceDeskBot")
4. Copy the token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
5. After first Vercel deploy, register webhook:
   ```bash
   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url="https://your-app.vercel.app/api/webhooks/telegram" \
     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
   ```
6. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL`, and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`

### Stripe (Billing)
1. Create Stripe account at https://stripe.com
2. Create three products and prices in Stripe Dashboard:
   - Basic ($299/month)
   - Professional ($499/month)
   - Enterprise ($799/month)
3. Copy Price IDs (`price_...` format) to `STRIPE_BASIC_PLAN_ID`, `STRIPE_PROFESSIONAL_PLAN_ID`, `STRIPE_ENTERPRISE_PLAN_ID`
4. Create webhook endpoint: Developers → Webhooks → Add endpoint
   - URL: `https://your-app.vercel.app/api/webhooks/stripe`
   - Events: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `charge.succeeded`
5. Copy signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`
6. Use test keys (`sk_test_...`) in development; live keys (`sk_live_...`) in production

### Inngest (Background Jobs)
1. Create account at https://inngest.com
2. Create a new workspace
3. Find Event Key and Signing Key in Inngest Dashboard → Settings
4. Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

## Database Initialization

Run migrations to set up the schema and RLS policies:
```bash
# Local Supabase
supabase migration up

# Remote (if using Vercel deployment)
npx supabase migration up --linked
```

Migrations are in `supabase/migrations/` and include:
- `20260504000001_initial_schema.sql` — core tables (contractors, agents, calls, leads, etc.)
- `20260504000002_rls_policies.sql` — RLS policies for all tables
- Additional migrations for webhook events, calendar tokens, notification settings, etc.

## Webhook Configuration

### Retell Webhook
- **URL:** `https://your-app.vercel.app/api/webhooks/retell`
- **Signing key:** Must match `RETELL_WEBHOOK_KEY`
- **Events:** `call_ended`, `call_analyzed`
- **Handler:** Returns 200 immediately; all processing in `after()` (Vercel `waitUntil`)

### Stripe Webhook
- **URL:** `https://your-app.vercel.app/api/webhooks/stripe`
- **Signing secret:** Must match `STRIPE_WEBHOOK_SECRET`
- **Events:** customer.subscription.*, invoice.*, charge.succeeded
- **Handler:** Returns 200 immediately; processing in `after()`

### Telegram Webhook
- **URL:** `https://your-app.vercel.app/api/webhooks/telegram`
- **Secret token:** Must match `TELEGRAM_WEBHOOK_SECRET`
- **Registration:** One-time POST to Telegram API with `setWebhook`
- **Handler:** Processes inline (no `after()` delay for Telegram)

Register with:
```bash
curl -X POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook \
  -d url="<TELEGRAM_WEBHOOK_URL>" \
  -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
```

## Troubleshooting

### "RETELL_WEBHOOK_KEY is not set"
- Verify the key is in Retell Dashboard → API Keys (should have a "webhook" badge)
- Ensure the key is set in Vercel environment variables (Production environment for production deploy)
- Webhook handler returns 500 until this is set

### "OAUTH_ENCRYPTION_KEY is not 64 hex characters"
- Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Must be exactly 64 characters (32 bytes as hex)
- Different key = cannot decrypt previously encrypted tokens (data loss)

### "Google OAuth app in test mode"
- Cannot connect Google Calendar until OAuth app is in Production mode
- Move to Production in Google Cloud Console → Credentials → Edit OAuth app
- Schedule a CASA Tier 2 security assessment (3–8 weeks)
- Phase 4 ships after assessment is approved

### "WABA approval pending"
- WhatsApp Business Account takes 3–7 business days to approve
- Submit in week 1 of development, do not wait until Phase 5
- Check Twilio Console → Messaging → Senders for approval status
- Phase 5 cannot ship until WABA is approved

### "Telegram bot username is wrong or empty"
- Bot username must be set in `.env.local` as `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- This variable is baked into the build — rebuild if changed
- Deep-links in NotificationSettingsForm will be broken if empty

### Missing environment variable at runtime
- Webhook handlers check for required secrets and return 500 if missing
- Check Vercel Function Logs: Dashboard → Deployments → recent deploy → Function Logs
- Ensure variable is set in Vercel environment (Production vs Preview)
- Allow up to 30 seconds after adding variables to Vercel before redeploy

## Security Best Practices

1. **Never commit secrets:** `.env.local` and `.env.test` are in `.gitignore` (verified)
2. **Service role key is server-only:** Never use in client components; only in API routes and Server Components
3. **Verify webhook signatures:** All webhook handlers verify HMAC-SHA256 signatures before processing
4. **Encrypt OAuth tokens:** Google refresh tokens encrypted at rest with AES-256-GCM
5. **Use environment-specific keys:** Production Stripe/Retell keys only in production environment; test keys in preview/development
6. **Rotate secrets regularly:** Especially Stripe webhook secret and Inngest signing key
7. **Audit Supabase RLS:** Before each deploy, test as unprivileged user to ensure RLS is enforced

