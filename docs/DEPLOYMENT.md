<!-- generated-by: gsd-doc-writer -->

# Deployment

Koolable is hosted on Vercel, a serverless platform optimized for Next.js applications. This guide covers project setup, environment configuration, build and deploy processes, monitoring, and troubleshooting.

## Vercel Project Setup

### 1. Link GitHub Repository

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Select your GitHub repository (`koolable`)
4. Vercel will auto-detect the Next.js framework
5. Click **"Deploy"**

Vercel will trigger the first build immediately. The build will fail until environment variables are configured (see [Environment Variables](#environment-variables) below).

### 2. Verify Build Settings

Vercel auto-detects Next.js configuration, but verify these settings:

- **Build Command:** `npm run build` (auto-detected)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm ci` (auto-detected)
- **Node.js Version:** Check Project Settings → Environment → Node.js version. If not pinned, Vercel will use its default (currently 22.x). For consistency with local development, consider pinning to the version in `.nvmrc` or `.node-version` (if present).

### 3. Domains and SSL/TLS

Vercel automatically provisions a default domain (`koolable-*.vercel.app`) with free SSL/TLS. For production:

1. If using a custom domain, go to **Project Settings** → **Domains**
2. Add your custom domain (e.g., `koolable.com`)
3. Vercel provides automatic HTTPS and SSL renewal
4. <!-- VERIFY: DNS configuration and CNAME records for custom domain -->

## Environment Variables

### Setting Variables in Vercel

1. Go to **Project Settings** → **Environment Variables**
2. Add each variable from `.env.example` with the appropriate value
3. **Important:** Use the dropdown for each variable to select which environments it applies to:
   - **Production** — deployed to main branch
   - **Preview** — deployed to PR/non-main branches
   - **Development** — local `npm run dev` (not used by Vercel, but supported)

### Per-Environment Configuration

**Production Environment (`main` branch)**
- All variables required (from CONFIGURATION.md)
- Use live API keys: `STRIPE_SECRET_KEY=sk_live_...`
- Use production URLs: `APP_URL=https://koolable.vercel.app` or custom domain
- <!-- VERIFY: Production Supabase project URL and credentials -->
- <!-- VERIFY: Production Retell, Twilio, Stripe, Google OAuth, and Inngest API credentials -->

**Preview Environment (PR branches)**
- Same variable names as production
- May use test/sandbox credentials: `STRIPE_SECRET_KEY=sk_test_...`
- `APP_URL=https://koolable-{branch-name}-{hash}.vercel.app` (auto-set by Vercel)
- Useful for testing webhook handlers in an isolated environment

**Development Environment (local machine)**
- Configured in `.env.local` (never committed to git)
- Copy from `.env.example` and fill in local/sandbox values
- `APP_URL` should point to ngrok tunnel for webhook testing: `https://xxxx.ngrok-free.app`

### Critical Security Notes

1. **Never commit `.env` files** — `.env.local`, `.env.*.local`, and `.env` are in `.gitignore`
2. **Service-role keys server-only** — Never set `SUPABASE_SERVICE_ROLE_KEY` or other secrets with `NEXT_PUBLIC_` prefix
3. **Rotate secrets regularly** — After any suspected compromise, regenerate API keys in all third-party dashboards and update Vercel variables
4. **Review variable access** — In Vercel Dashboard, check **Settings** → **Team** to ensure only authorized team members can view secrets

## Build and Deploy Process

### Build Pipeline

When you push to GitHub, Vercel runs:

1. **Clone & install** — Checks out your code, runs `npm ci` (clean install)
2. **Build** — Executes `npm run build`
   - Next.js compiles TypeScript → JavaScript
   - Bundling CSS and JavaScript assets
   - Generates `.next/` directory with optimized code
3. **Output validation** — Vercel checks that `.next/` was created and contains `server/` and `static/` subdirectories
4. **Deploy** — Copies built artifacts to serverless function infrastructure

**Build timeout:** Vercel allows up to 45 minutes for builds (standard). If your build takes longer:
- Check for missing environment variables (some builds block on optional dependencies)
- Simplify source files or split into multiple smaller modules
- <!-- VERIFY: Contact Vercel support for build time extension if needed -->

### Next.js Build Artifacts

The build creates:
- **`.next/server/`** — Server-side code (API routes, Server Components)
- **`.next/static/`** — Client-side bundles (CSS, JavaScript, images)
- **`.next/standalone/`** — Standalone server (used by Vercel's serverless functions)

### Server Functions (API Routes)

API routes in `src/app/api/*/route.ts` are deployed as serverless functions (no cold start penalty on Vercel). Examples:

- `POST /api/webhooks/retell` — Accepts webhook events from Retell AI
- `POST /api/webhooks/stripe` — Accepts webhook events from Stripe
- `POST /api/webhooks/telegram` — Accepts webhook events from Telegram
- `POST /api/inngest/route.ts` — Inngest event serving endpoint (required for background jobs)

Each function is individually scaled and billed. Request timeout per function: 25 seconds (Pro plan) or 5 seconds (Hobby).

<!-- VERIFY: Confirm Vercel plan type and per-function timeout limits -->

### Edge Functions (Optional)

Koolable does not currently use Edge Functions (deployed at CDN edge locations). If you need ultra-low latency for middleware, authentication, or request manipulation:

1. Create middleware in `src/middleware.ts`
2. Configure `matcher` pattern in middleware config
3. Vercel automatically deploys as Edge Function
4. Execution environment: Cloudflare Workers (restricted API surface)

## Preview Deployments

Vercel automatically creates preview URLs for every pull request. Benefits:

- **Isolation** — Each PR has its own URL (e.g., `https://koolable-pr-42.vercel.app`)
- **Webhooks** — Preview deployments can receive Retell/Stripe/Telegram webhooks using the preview URL
- **Shared testing** — Share preview URL with QA/stakeholders for testing before merge
- **Automatic cleanup** — Preview deployments are deleted when PR is closed

### Webhook Testing on Preview

To test webhooks on a preview deployment:

1. Push your branch to GitHub (triggers preview build)
2. Copy the preview URL from the PR comment (e.g., `https://koolable-pr-42.vercel.app`)
3. Temporarily update webhook URLs in the respective service dashboard:
   - **Retell Dashboard** → Agent settings → Webhook URL (update to preview URL)
   - **Stripe Dashboard** → Developers → Webhooks → Endpoint → Update URL
   - **Telegram** → `/setWebhook` with preview URL
4. Test webhook handlers on preview
5. Revert URLs to production before merging to `main`

**Note:** Each preview deployment has its own environment variables (inherited from Preview environment in Vercel Settings).

## Production Promotions

### Deploying to Production

1. **Merge PR to `main`** — Triggers Vercel build
2. **Vercel auto-deploys** — On successful build, production deployment is live
3. **Verify deployment** — Check Vercel Dashboard for deployment status and logs

**No manual promotion step needed** — Vercel uses a push-based deployment model (continuous deployment).

### Rollback to Previous Deployment

If a production deployment introduces a bug or breaking change:

1. Go to **Vercel Dashboard** → **Deployments** → **Production**
2. Find the previous stable build (usually the prior commit)
3. Click **"Promote to Production"** (three-dot menu on the right)
4. Confirm — Vercel will re-deploy the previous build

Alternatively, revert the git commit and push:
```bash
git revert <commit-hash>  # Creates a new commit with the revert
git push origin main
```

Vercel will immediately build and deploy the reverted code.

### Viewing Deployment Logs

1. Go to **Vercel Dashboard** → **Deployments**
2. Click on a specific deployment to see:
   - **Build logs** — `npm install` and `npm run build` output
   - **Runtime logs** — API route and function execution logs
   - **Errors** — Build or runtime failures
3. Stream live logs during deployment by clicking **"View Function Logs"** during the build

## Monitoring

### Error Tracking and Logging

Koolable logs events to stdout (visible in Vercel Function Logs). Error logging is handled by console.error() in key places:

- **Webhook handlers** — Log verification failures, signature mismatches, and handler errors
- **API routes** — Log validation failures, external API errors
- **Inngest functions** — Logged via Inngest Dashboard (see below)

For production error tracking, consider integrating:

- <!-- VERIFY: Sentry, Datadog, or New Relic for centralized error monitoring -->

### Vercel Metrics and Analytics

1. Go to **Vercel Dashboard** → **Analytics**
2. View:
   - **Real-time requests** — Current API call rate and latency
   - **Function count** — Number of deployed serverless functions
   - **Build time trends** — Historical build duration
   - **Edge Network cache hit rate** — Percentage of requests served from CDN (images, CSS, static assets)

### Inngest Dashboard

All background jobs (classification, notifications, agent sync, payment failures) are managed by Inngest. Monitor at [https://app.inngest.com](https://app.inngest.com):

1. Sign in with your Inngest account
2. Select your environment (Production/Preview/Development)
3. View:
   - **Function runs** — Execution history, success/failure, retry counts
   - **Logs** — Per-function execution logs
   - **Failed runs** — Investigate and manually trigger re-run
   - **Event history** — All enqueued events, filtering by function

**Critical:** Inngest uses `APP_URL` to call back to your `/api/inngest` endpoint. If `APP_URL` is incorrect or changes, function invocations will fail with `DEPLOYMENT_NOT_FOUND` errors.

### Monitoring Webhook Handlers

Monitor webhook success in:

- **Retell Dashboard** → Agent settings → View webhook delivery history (success/failure/retry count)
- **Stripe Dashboard** → Developers → Webhooks → Endpoint → View deliveries
- **Telegram Bot API** → Check bot webhook status via `getWebhookInfo` API call

All webhook handlers return HTTP 200 immediately (deferred processing). Check downstream job results in Inngest Dashboard.

## Database Connection (Supabase)

### Connection Pooling

Koolable uses Supabase's PostgreSQL database. For production, enable **PgBouncer connection pooling** to prevent exhausting the connection limit:

1. Go to **Supabase Dashboard** → **Project** → **Database** → **Connection pooling**
2. Enable **"Use connection pooling"** (mode: Transaction)
3. Copy the **"Connection string (pooling mode)"**
4. Update your `NEXT_PUBLIC_SUPABASE_URL` in Vercel to use the pooling endpoint

**Why connection pooling matters:**
- Vercel serverless functions are ephemeral (each invocation may create a new connection)
- Without pooling, 100+ concurrent deployments can exceed PostgreSQL's default max connections (100)
- PgBouncer multiplexes connections, allowing 10,000+ concurrent clients on 20 pooled connections

<!-- VERIFY: Confirm connection pool settings and max client limit in Supabase project -->

### Database Backups

Supabase provides daily backups (included in Pro plan). To restore:

1. **Supabase Dashboard** → **Database** → **Backups**
2. Select a backup and click **"Restore"** (requires 48-hour wait after the backup)
3. Restoration creates a new database instance; you must migrate data back

For critical data loss, contact Supabase support for point-in-time recovery (PITR).

## Background Jobs (Inngest)

Inngest is used for durable, reliable background job execution. Inngest functions handle:

- **retell-call-classify** — Intent classification and trade data extraction (runs on every call_ended webhook)
- **retell-notify-dispatch** — Multi-channel notifications (SMS, WhatsApp, Telegram, email)
- **retell-agent-sync** — Sync agent settings to Retell API when contractor updates settings
- **stripe-payment-failure** — Handle payment failures and send notification emails

### Configuration for Production

All Inngest configuration is environment-variable driven:

- `INNGEST_EVENT_KEY` — API key to enqueue events
- `INNGEST_SIGNING_KEY` — Webhook signing key (Inngest → your `/api/inngest`)

Verify in Vercel:
1. **Settings** → **Environment Variables** → Check both keys are set
2. Both Production and Preview environments must have valid keys (or Inngest will reject requests)

### Critical: APP_URL Stability

The Inngest serve endpoint (`/api/inngest`) uses `APP_URL` as its `serveOrigin`. This must be **stable and permanent**:

```typescript
// src/app/api/inngest/route.ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  serveOrigin: process.env.APP_URL,  // ← Must be consistent
  functions: [...]
})
```

**If `APP_URL` is incorrect:**
- Inngest will attempt to send events to the wrong endpoint
- Functions will fail with `DEPLOYMENT_NOT_FOUND`
- Check Inngest Dashboard → Failed Runs to diagnose

**If `APP_URL` changes after initial setup:**
- All in-flight jobs will fail
- Solution: Update `APP_URL` in Vercel, redeploy, manually trigger failed jobs in Inngest Dashboard

**Recommended approach:**
- Use a permanent, top-level domain (e.g., `https://koolable.vercel.app` or custom domain)
- Never use branch-specific preview URLs for production Inngest configuration
- Use separate Inngest event keys for Preview and Production environments

## Webhook Endpoints in Production

### Retell Webhook URL

Retell AI sends webhook events to `POST /api/webhooks/retell` for all provisioned agents. The webhook URL is set during agent provisioning:

```
POST https://koolable.vercel.app/api/webhooks/retell
Content-Type: application/json
X-Retell-Signature: v=<timestamp>,d=<hmac-sha256>

{ "event": "call_ended", "call": {...} }
```

**Configuration:**
- `APP_URL` must be set in Vercel (e.g., `https://koolable.vercel.app`)
- `RETELL_WEBHOOK_KEY` must match the key in Retell Dashboard
- Webhook URL is registered in `/api/provisioning/create` when contractors create new agents

**Verification:** Retell Dashboard → Agent settings → View webhook delivery history

### Stripe Webhook URL

Stripe sends payment and subscription events to `POST /api/webhooks/stripe`. The endpoint URL is registered in:

```
Stripe Dashboard → Developers → Webhooks → Add endpoint
URL: https://koolable.vercel.app/api/webhooks/stripe
Events: charge.failed, invoice.payment_failed, customer.subscription.updated
```

**Configuration:**
- `STRIPE_WEBHOOK_SECRET` must match the signing secret in Stripe Dashboard
- Must use HTTPS (Stripe rejects non-HTTPS endpoints)

**Verification:** Stripe Dashboard → Developers → Webhooks → Endpoint → View all events

### Telegram Webhook URL

Telegram Bot API sends webhook updates to `POST /api/webhooks/telegram`. The endpoint URL is registered via bot API call:

```bash
curl -X POST \
  "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://koolable.vercel.app/api/webhooks/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

**Configuration:**
- `APP_URL` must point to the correct production domain
- `TELEGRAM_WEBHOOK_SECRET` must be the same value passed to `setWebhook`
- <!-- VERIFY: Document the exact curl command and secret token generation process -->

**Verification:** Get webhook info via:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Secrets Management

### Environment Variable Encryption

Vercel automatically encrypts all environment variables at rest. Secrets are:
- Encrypted using AES-256
- Decrypted only when injected into function environment at runtime
- Never logged or exposed in build output
- Rotatable at any time (no downtime)

### OAuth Token Encryption

Google OAuth refresh tokens are encrypted with AES-256-GCM **at the application level** before being written to Supabase:

```typescript
// lib/crypto/tokens.ts
export function encryptToken(token: string, key: string): string {
  // AES-256-GCM encryption
}
```

This provides **defense in depth** — even if Supabase is compromised, tokens cannot be decrypted without `OAUTH_ENCRYPTION_KEY`.

### Credential Rotation

To rotate credentials (API keys, secrets) without downtime:

1. **Generate new credential** in the third-party service (Retell, Stripe, Google, etc.)
2. **Add new value to Vercel** → **Settings** → **Environment Variables** (keep old value for now)
3. **Update code** to prefer the new credential (if applicable)
4. **Verify new credential works** — test in Preview deployment
5. **Merge to production** — Vercel redeploys with new credential
6. **Revoke old credential** in the third-party service after 24 hours (grace period for in-flight requests)

## Post-Deployment Validation Checklist

After every production deployment, verify:

- [ ] **Health check:** Navigate to https://koolable.vercel.app (or custom domain) — page loads, user can log in
- [ ] **API routes respond:** Call `POST /api/contractors/status` — returns 200 with contractor data
- [ ] **Inngest connected:** Check Inngest Dashboard — new events appear in event history (not failures)
- [ ] **Webhook signature verification:** Check webhook handler logs for no "signature_failed" errors
- [ ] **Database accessible:** Check Supabase Dashboard — no increase in error rate or slow queries
- [ ] **Retell agent provisions:** Test provisioning a new agent — Twilio number assigned, Retell agent created
- [ ] **Call webhook receives events:** Make a test call to the provisioned number — Retell webhook events appear in logs
- [ ] **Inngest classification runs:** Check Inngest Dashboard — `retell-call-classify` jobs complete successfully
- [ ] **Notifications dispatch:** Check `notification_logs` table — SMS/WhatsApp/Telegram notifications sent
- [ ] **Google Calendar books appointments:** Make a test call classified as "lead" — appointment appears in calendar

## Troubleshooting

### Build Fails: `npm run build` Error

**Symptom:** Vercel build log shows `npm run build` failed with TypeScript or ESLint errors.

**Diagnosis:**
1. Go to **Vercel Dashboard** → **Deployments** → View failed build log
2. Look for specific error line numbers and file paths
3. Check if error is TypeScript (`tsc`) or ESLint (`next lint`)

**Solutions:**
- **TypeScript error:** Fix type issues locally, commit, re-deploy
- **ESLint error:** Fix linting violations (usually formatting), commit, re-deploy
- **Missing environment variable:** Check Vercel **Settings** → **Environment Variables** — some build-time variables may be missing (e.g., `NEXT_PUBLIC_*`)

### Build Timeout

**Symptom:** Vercel log shows build exceeded 45 minutes (or time limit for your plan).

**Diagnosis:**
1. Check Vercel build time history (**Deployments** → View previous builds)
2. Look for specific slow steps in the build log (npm install, TypeScript compilation, etc.)

**Solutions:**
- Check if `node_modules/.bin/tsc` is stuck on a specific file (massive module)
- Ensure all `NEXT_PUBLIC_*` variables are set in Vercel (builds may hang if they're missing)
- Split large components or modules to reduce TypeScript compilation time
- <!-- VERIFY: Check with Vercel support if build time limit can be extended -->

### Runtime Error: API Route Returns 500

**Symptom:** API route (e.g., `POST /api/webhooks/retell`) returns HTTP 500.

**Diagnosis:**
1. Go to **Vercel Dashboard** → **Deployments** → Select production deployment → **Function Logs**
2. Filter by route name (e.g., `webhooks/retell`)
3. Look for error message and stack trace

**Common causes:**
- Missing environment variable (e.g., `RETELL_WEBHOOK_KEY` not set in Vercel)
- External service down (Retell, Stripe, Supabase API)
- Database connection failure (check Supabase status)
- Timeout (function exceeded 25-second limit)

### Webhook Handler: Signature Verification Fails

**Symptom:** Webhook handler logs show `[webhook.retell.signature_failed]` or similar.

**Diagnosis:**
1. Check the webhook signature key in the third-party service dashboard (Retell, Stripe, Telegram)
2. Compare with the value in **Vercel Settings** → **Environment Variables**
3. Check if the key was recently rotated

**Solutions:**
- Update Vercel environment variable to match the current key in the third-party service
- Redeploy (Vercel will inject the new variable)
- Re-trigger the webhook in the third-party service dashboard (manual event resend)

### Inngest Functions Fail: DEPLOYMENT_NOT_FOUND

**Symptom:** Inngest Dashboard shows failed runs with error `DEPLOYMENT_NOT_FOUND`.

**Diagnosis:**
1. Check `APP_URL` in **Vercel Settings** → **Environment Variables**
2. Verify it points to the correct production domain (not a preview URL)
3. Check if `APP_URL` has a trailing slash (it shouldn't)
4. Verify `/api/inngest` responds (curl test below)

**Verification:**
```bash
curl -X GET https://koolable.vercel.app/api/inngest
# Should return 200 (Inngest introspection response)
```

**Solutions:**
- Update `APP_URL` to the stable production domain
- Remove trailing slash if present
- Redeploy
- Manually trigger failed Inngest jobs in Inngest Dashboard to retry

### Database Connection Limit Exceeded

**Symptom:** Supabase logs show `"remaining connection slots reserved for non-replication superuser connections"` errors.

**Diagnosis:**
1. Go to **Supabase Dashboard** → **Database** → **Connections**
2. Check active connections (should be <100 without pooling, <20 with pooling)
3. If many connections from Vercel, connection pooling is not enabled

**Solutions:**
- Enable PgBouncer connection pooling (see [Database Connection](#database-connection-supabase) section)
- Use pooled connection string for `NEXT_PUBLIC_SUPABASE_URL`
- Redeploy

### Cannot Connect to Google Calendar API

**Symptom:** Scheduling fails with "invalid_grant" or "expired token" errors.

**Diagnosis:**
1. Check if Google OAuth app is in **Production mode** (required for contractor access)
2. Check if OAuth token is expired (Supabase `calendar_token_expires_at` timestamp)
3. Check if `OAUTH_ENCRYPTION_KEY` is set in Vercel (required to decrypt tokens)

**Solutions:**
- Ensure Google OAuth app is in Production mode (OAuth apps in "Testing" mode expire after 7 days)
- Contractor must re-authenticate (visit `/api/auth/google/initiate` to refresh token)
- Verify `OAUTH_ENCRYPTION_KEY` is set and matches the key used when token was encrypted

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment/vercel)
- [Supabase with Vercel](https://supabase.com/docs/guides/deployment/vercel)
- [Inngest Documentation](https://www.inngest.com/docs)
- [CONFIGURATION.md](CONFIGURATION.md) — Environment variable reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and webhook flow
