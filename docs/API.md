<!-- generated-by: gsd-doc-writer -->

# API Reference

Koolable exposes six primary API endpoints for receiving webhook events, managing notifications, handling billing, and supporting account provisioning. All endpoints use Next.js App Router handlers and enforce authentication via JWT (Supabase auth) or cryptographic webhook signature verification.

## Authentication

### Webhook Authentication (Signature Verification)

**Retell webhook** (`POST /api/webhooks/retell`) and **Stripe webhook** (`POST /api/webhooks/stripe`) verify HMAC-SHA256 signatures before processing payloads. No authentication header is required; instead, the request body and timestamp are verified using the webhook signing key.

- **Retell:** Uses `x-retell-signature` header with format `v={timestamp},d={digest}`. Verified with `RETELL_WEBHOOK_KEY`. 5-minute timestamp window.
- **Stripe:** Uses `stripe-signature` header. Verified with `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent()`.

### API Authentication (User/Session)

All non-webhook endpoints require an authenticated Supabase JWT:

```bash
curl -H "Authorization: Bearer {JWT}" https://your-app.vercel.app/api/notification-settings
```

The JWT is automatically included in requests from the browser (Next.js server-side code). API clients must obtain a JWT via Supabase auth login.

---

## Endpoints Overview

| Method | Path | Purpose | Auth | Rate Limit |
|--------|------|---------|------|-----------|
| POST | `/api/webhooks/retell` | Receive call_ended and call_analyzed events | Signature | 100/minute |
| GET | `/api/recordings` | Retrieve signed URL for call recording | JWT | 50/minute |
| POST | `/api/inngest` | Inngest function dispatch endpoint | Signature | ✓ (platform-managed) |
| PATCH | `/api/notification-settings` | Update SMS, WhatsApp, Telegram, email settings | JWT | 20/minute |
| POST | `/api/webhooks/stripe` | Receive subscription and payment events | Signature | 100/minute |
| POST | `/api/onboarding/create-account` | Create contractor account on first login | JWT | 5/minute |
| POST | `/api/stripe/portal` | Create Stripe Customer Portal session | JWT | 10/minute |

---

## Retell Webhook

### `POST /api/webhooks/retell`

Receives call lifecycle events (`call_ended`, `call_analyzed`) from Retell AI. Verifies HMAC-SHA256 signature before processing. Returns 200 immediately; all downstream processing (Supabase writes, Inngest jobs) runs in the background via `after()`.

**Headers:**
- `x-retell-signature` (required) — Format: `v={timestamp},d={digest}` where digest is HMAC-SHA256(body + timestamp, RETELL_WEBHOOK_KEY)

**Request body (call_ended event):**

```json
{
  "event": "call_ended",
  "call": {
    "call_id": "d6e8c2a1-e3f4-4b1a-9c2d-5e8f7a6b9c3d",
    "agent_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
    "from_number": "+13055551234",
    "to_number": "+14165554567",
    "direction": "inbound",
    "call_status": "ended",
    "start_timestamp": 1717880400000,
    "end_timestamp": 1717880460000,
    "duration_ms": 60000,
    "recording_url": "https://retell-public-assets.s3.us-west-1.amazonaws.com/recordings/...",
    "transcript": "Agent: Hello, this is Koolable...\nCaller: Hi, I need...",
    "transcript_object": [
      {
        "role": "agent",
        "content": "Hello, this is Koolable. How can I help?",
        "words": [
          { "word": "Hello", "start": 0, "end": 500 },
          { "word": "Koolable", "start": 600, "end": 1100 }
        ]
      },
      {
        "role": "user",
        "content": "I need to schedule an appointment.",
        "words": [
          { "word": "I", "start": 1200, "end": 1300 }
        ]
      }
    ],
    "call_analysis": {
      "call_summary": "Customer called to schedule HVAC maintenance.",
      "call_successful": true,
      "in_voicemail": false,
      "user_sentiment": "Positive"
    },
    "disconnection_reason": "normal"
  }
}
```

**Response:**

```json
{
  "status": "ok"
}
```

**Status code:** 200 (always returned immediately; processing happens in background)

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `Unauthorized` | Signature verification failed (timestamp expired, HMAC mismatch, or malformed signature) |
| 400 | `Bad Request` | Malformed JSON body after successful signature verification |
| 500 | `Internal Server Error` | `RETELL_WEBHOOK_KEY` environment variable is not set |

**Example cURL:**

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/retell \
  -H "Content-Type: application/json" \
  -H "x-retell-signature: v=1717880400000,d=abc123def456..." \
  -d @call_ended_payload.json
```

**Key processing:**

- **call_ended:** Creates skeleton `calls` row with status='completed', analysis_status='analyzing', is_after_hours detection
- **call_analyzed:** Enriches `calls` row with transcript + summary, triggers Inngest classification job
- **Contractor lookup:** `contractor_id` is looked up from `call.agent_id` server-side; never accepted from the webhook payload
- **Idempotency:** Both handlers UPSERT on `retell_call_id`, protecting against duplicate webhook delivery

---

## Recordings

### `GET /api/recordings`

Retrieves a signed URL for downloading a call recording. Verifies the authenticated user owns the call before generating the signed URL.

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `callId` | string | Yes | The ID of the call (from the `calls` table) |

**Authentication:** JWT (Supabase auth)

**Response (200):**

```json
{
  "signedUrl": "https://your-project.supabase.co/storage/v1/object/sign/recordings/path/to/recording.mp3?token=eyJ..."
}
```

The signed URL is valid for 60 seconds and includes a storage access token.

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `{"error": "Unauthorized"}` | No authenticated user (JWT missing or expired) |
| 400 | `{"error": "Missing callId"}` | `callId` query parameter not provided |
| 404 | `{"error": "Contractor not found"}` | Authenticated user has no contractor record |
| 404 | `{"error": "Call not found"}` | Call does not exist or does not belong to the authenticated contractor |
| 404 | `{"error": "No recording available"}` | Call exists but has no recording_url |
| 400 | `{"error": "Invalid recording path"}` | Recording path contains directory traversal characters (`..` or null bytes) |
| 500 | `{"error": "Failed to create signed URL"}` | Supabase storage service error |

**Example cURL:**

```bash
curl -H "Authorization: Bearer $JWT" \
  "https://your-app.vercel.app/api/recordings?callId=550e8400-e29b-41d4-a716-446655440000"
```

**Notes:**

- The signed URL uses Supabase Storage and expires after 60 seconds
- Ownership is verified via RLS (row-level security) before generating the URL
- Recording URLs are stored in the `calls.recording_url` column as full URLs from Retell

---

## Inngest

### `POST /api/inngest`

This is the Inngest function dispatch and introspection endpoint. It handles:
- Function registration and schema introspection (Inngest SDK requires this for serverless deployments)
- Event delivery from the Inngest platform

**Method:** POST, PUT, GET (all handled by `serve()` adapter)

**Headers:**

- `Authorization: Bearer {INNGEST_SIGNING_KEY}` (automatically verified by `serve()`)

**Request body:**

Inngest sends proprietary JSON. You do not call this endpoint directly; instead, call `inngest.send()` from your code.

**Response:**

Returns 200 with Inngest-specific responses (function schemas, ack, etc.). Details are opaque to the application.

**Error responses:**

| Status | Reason |
|--------|--------|
| 401 | Invalid or missing `INNGEST_SIGNING_KEY` signature |
| 400 | Malformed request body |

**Registered functions:**

The following Inngest functions are registered and triggered via webhooks or manual sends:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `retell/call.classify` | After `call_analyzed` webhook | LLM-based intent classification, emergency keyword detection |
| `retell/agent.sync` | Manual provisioning endpoint | Sync Retell agent config to Supabase |
| `retell/analysis.timeout` | Cron (30-minute timeout) | Mark analyses as failed if still pending |
| `retell/notify.dispatch` | After `call.classify` | Send SMS/WhatsApp/Telegram notifications per contractor settings |
| `stripe/payment.failure` | `invoice.payment_failed` webhook | Notify contractor of failed payment, trigger suspension logic |

**Endpoint:** `POST /api/inngest`

---

## Notification Settings

### `PATCH /api/notification-settings`

Updates notification preferences for SMS, WhatsApp, Telegram, and email. Phone numbers are validated and normalized to E.164 format before storage. `contractor_id` is derived from the authenticated user's session; request body cannot override it.

**Authentication:** JWT (Supabase auth)

**Request body:**

```json
{
  "sms_number": "+1 (305) 555-1234",
  "whatsapp_number": "+13055551234",
  "notify_sms_enabled": true,
  "notify_whatsapp_enabled": true,
  "notify_telegram_enabled": false,
  "notify_email_enabled": true,
  "email_address": "contractor@example.com",
  "notify_on_lead": true,
  "notify_on_emergency": true,
  "notify_on_general_inquiry": false
}
```

All fields are optional. Omitted fields are not updated.

**Response (200):**

```json
{
  "id": "ns-550e8400-e29b-41d4-a716-446655440000",
  "contractor_id": "c-550e8400-e29b-41d4-a716-446655440001",
  "sms_number": "+13055551234",
  "whatsapp_number": "+13055551234",
  "notify_sms_enabled": true,
  "notify_whatsapp_enabled": true,
  "notify_telegram_enabled": false,
  "notify_email_enabled": true,
  "email_address": "contractor@example.com",
  "notify_on_lead": true,
  "notify_on_emergency": true,
  "notify_on_general_inquiry": false,
  "created_at": "2026-05-08T14:30:00Z",
  "updated_at": "2026-05-08T14:35:00Z"
}
```

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `{"error": "Unauthorized"}` | No authenticated user |
| 404 | `{"error": "Contractor not found"}` | Authenticated user has no contractor record |
| 400 | `{"error": "Invalid JSON body"}` | Request body is not valid JSON |
| 422 | `{"error": "Invalid request body"}` | Request body violates schema (e.g., email not a valid email) |
| 422 | `{"error": "Invalid SMS number: enter a valid US phone number"}` | sms_number is not a valid US phone number |
| 422 | `{"error": "Invalid WhatsApp number: enter a valid US phone number"}` | whatsapp_number is not a valid US phone number |
| 500 | `{"error": "Failed to update notification settings"}` | Database write error |

**Phone normalization:**

- Input: `(305) 555-1234` or `305-555-1234` or `+1 305 555 1234`
- Output (E.164): `+13055551234`
- Default region: US
- Non-US numbers rejected (422)

**Example cURL:**

```bash
curl -X PATCH \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sms_number": "+13055551234",
    "notify_sms_enabled": true,
    "notify_on_emergency": true
  }' \
  https://your-app.vercel.app/api/notification-settings
```

---

## Stripe Webhook

### `POST /api/webhooks/stripe`

Receives subscription and payment events from Stripe. Verifies HMAC-SHA256 signature using `stripe-signature` header. Returns 200 immediately; all downstream processing (Supabase writes, notifications, Inngest jobs) runs in the background.

**Headers:**

- `stripe-signature` (required) — Stripe's webhook signature. Format verified by `stripe.webhooks.constructEvent()`

**Handled events:**

| Event | Description |
|-------|-------------|
| `checkout.session.completed` | User completed checkout; subscription activated with 14-day trial |
| `invoice.payment_failed` | Subscription payment failed; triggers notification and suspension logic |
| `customer.subscription.updated` | Subscription tier changed or trial end updated; updates `contractors.subscription_status` and `trial_ends_at` |

**Request body (checkout.session.completed example):**

```json
{
  "id": "evt_1234567890",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123456",
      "object": "checkout.session",
      "customer": "cus_123456789",
      "subscription": "sub_123456789",
      "metadata": {
        "contractor_id": "c-550e8400-e29b-41d4-a716-446655440001",
        "price_id": "price_1234567890"
      }
    }
  }
}
```

**Response (200):**

```
OK
```

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `Unauthorized` | Signature verification failed |
| 400 | (none) | Request body is malformed JSON |
| 500 | `Internal Server Error` | `STRIPE_WEBHOOK_SECRET` environment variable is not set |

**Key behavior:**

- **Signature verification:** Stripe signature checked before any payload parsing
- **Idempotency:** `webhook_events` table prevents duplicate processing of the same event
- **Error logging:** All events logged with event type and event ID before processing
- **Tier detection:** Price ID from metadata mapped to subscription tier (basic/professional/enterprise)

**Example cURL:**

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1234567890,v1=abc123def456..." \
  -d @stripe_event_payload.json
```

---

## Onboarding

### `POST /api/onboarding/create-account`

Creates a contractor account and related records on first login (after Supabase auth signup). Idempotent; repeated calls update existing records. Must be called before any contractor-scoped endpoints are usable.

**Authentication:** JWT (Supabase auth)

**Request body:**

```json
{
  "business_name": "Smith HVAC & Plumbing",
  "phone_number": "(305) 555-1234",
  "area_code": "HVAC"
}
```

**Response (200):**

```json
{
  "contractor_id": "c-550e8400-e29b-41d4-a716-446655440001"
}
```

**Created/updated records:**

1. **contractors** — User's contractor profile
   - Fields: `user_id`, `email`, `phone_number` (E.164), `business_name`, `area_code`
   - Idempotency: Updates if contractor already exists for this user
2. **contractor_settings** — Agent configuration defaults
   - Upserted; uses database defaults for `supported_languages`, `emergency_keywords`, `business_hours`
3. **notification_settings** — Notification preferences (empty on creation)
   - Inserted with contractor_id; populated later via PATCH `/api/notification-settings`

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `{"error": "Unauthorized"}` | No authenticated user |
| 400 | `{"error": "Invalid request body"}` | Request body is not valid JSON |
| 400 | `{"error": "Invalid input"}` | Missing required fields or validation error |
| 500 | `{"error": "Failed to create contractor."}` | Database insert error |
| 500 | `{"error": "Failed to complete account setup."}` | Settings or notification_settings insert failed |

**Phone normalization:**

Same as notification-settings: `(305) 555-1234` → `+13055551234` (E.164 with country code 1)

**Example cURL:**

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Smith HVAC & Plumbing",
    "phone_number": "(305) 555-1234",
    "area_code": "HVAC"
  }' \
  https://your-app.vercel.app/api/onboarding/create-account
```

---

## Stripe Portal

### `POST /api/stripe/portal`

Creates a Stripe Customer Portal session, redirecting the contractor to manage their subscription (upgrade/downgrade tier, update payment method, view invoices). Returns a portal URL that remains valid for 24 hours.

**Authentication:** JWT (Supabase auth)

**Request body:**

Empty or omitted. The endpoint uses the authenticated user's contractor record to look up the Stripe customer ID.

```json
{}
```

**Response (200):**

```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

The returned URL should be opened in a new tab or redirected to via HTTP 302.

**Error responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `{"error": "Unauthorized"}` | No authenticated user |
| 404 | `{"error": "Contractor not found"}` | Authenticated user has no contractor record |
| 400 | `{"error": "No Stripe customer found"}` | Contractor has no `stripe_customer_id` (checkout not completed) |
| 500 | `{"error": "Server misconfiguration"}` | `APP_URL` / `NEXT_PUBLIC_APP_URL` environment variable is not set |
| 500 | `{"error": "Failed to create portal session"}` | Stripe API error or network issue |

**Example cURL:**

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT" \
  https://your-app.vercel.app/api/stripe/portal
```

**Return URL:** The portal redirects back to `/settings/account` after the contractor exits.

---

## Rate Limits

All endpoints (except webhooks) are subject to rate limits enforced per authenticated user or IP:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/recordings` | 50 | 1 minute |
| `/api/notification-settings` | 20 | 1 minute |
| `/api/onboarding/create-account` | 5 | 1 minute |
| `/api/stripe/portal` | 10 | 1 minute |
| Webhooks (Retell, Stripe, Telegram) | 100 | 1 minute |

Webhook rate limits are applied per contractor's agent ID (Retell, Stripe) to prevent abuse.

Exceeding the limit returns HTTP 429 (Too Many Requests).

---

## Error Handling

### Standard Error Response Format

All endpoints return errors as JSON with an `error` key and descriptive message:

```json
{
  "error": "Descriptive message for the client"
}
```

**Internal errors** (500, 502, 503) log full stack traces server-side; clients receive a generic error message. Check Vercel Function Logs for diagnostics.

**Validation errors** (400, 422) include the specific field or constraint that failed.

**Webhook signature errors** (401) do not include payload details in the response to avoid information leakage.

---

## Verification Notes

<!-- VERIFY: Rate limit values are environment-dependent and enforced by Vercel middleware (confirm exact limits and enforcement mechanism) -->

<!-- VERIFY: Stripe portal return URL configuration and session timeout duration -->

