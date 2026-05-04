# Technology Stack — VoiceDesk

**Project:** VoiceDesk (AI phone receptionist for home-service contractors)
**Researched:** 2026-05-03
**Confidence note:** Bash, WebSearch, and WebFetch were unavailable in this session.
All findings are from training data (cutoff August 2025) cross-referenced with
known API documentation structures. Confidence levels are reduced accordingly
where live verification was not possible.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 14.x (App Router) | Frontend + API routes | Server Actions + Route Handlers eliminate need for a separate Express API; Vercel-native; supports streaming for future real-time features |
| TypeScript | 5.x | Language | End-to-end type safety; Retell and Supabase both ship first-class TS types |
| Vercel | — | Hosting | Edge Functions for webhook endpoints (lower cold-start latency than serverless); zero-ops; pairs with Next.js |

---

## 1. Retell AI Integration

**Confidence: MEDIUM** — Based on Retell v2 API documentation patterns known through training cutoff. Verify package version before install.

### SDK and Auth

```bash
npm install retell-sdk        # official Retell Node.js SDK (v2+)
```

- Authentication: API key passed as `Authorization: Bearer <RETELL_API_KEY>` header on all requests.
- Base URL: `https://api.retellai.com` (v2 prefix paths like `/v2/create-agent`).
- The SDK wraps the REST API; use the SDK rather than raw `fetch` to get typed responses and automatic retries.

### Agent Configuration Pattern

Agents are created once per contractor (not per call). Store the returned `agent_id` in the `contractors` table. Key parameters to set at agent creation/update:

```typescript
// Create agent for a contractor (called during onboarding)
const agent = await retellClient.agent.create({
  agent_name: `${contractor.businessName} Receptionist`,
  voice_id: "11labs-Myra",          // stock voice — choose female, clear diction
  response_engine: {
    type: "retell-llm",
    llm_id: llm.llm_id,              // created separately
  },
  language: "en-US",
  ambient_sound: "office",           // reduces dead-air awkwardness
  enable_backchannel: true,          // "mm-hmm" filler sounds, critical for voice UX
  interruption_sensitivity: 0.8,    // allow callers to interrupt freely
  end_call_after_silence_ms: 600,
  max_call_duration_ms: 600_000,    // 10 min hard cap — prevents billing runaway
});
```

**LLM configuration** (separate resource from agent):

```typescript
const llm = await retellClient.llm.create({
  model: "gpt-4o",                   // NOT gpt-4-turbo — o has lower latency
  general_prompt: buildSystemPrompt(contractor),
  general_tools: [
    { type: "end_call" },
    { type: "transfer_call", number: contractor.phone },
    // Custom tools handled via webhook:
    { type: "custom", name: "book_appointment", ... },
    { type: "custom", name: "send_emergency_alert", ... },
  ],
  begin_message: `Thank you for calling ${contractor.businessName}. I'm the virtual assistant. How can I help you today?`,
});
```

### Inbound Call Flow — Twilio to Retell

The connection between Twilio and Retell uses Retell's Twilio integration (not raw SIP). Retell manages the SIP trunk internally.

**Setup steps:**

1. Provision a Twilio number in your Twilio account.
2. In the Retell dashboard (or via API), import that Twilio number into Retell by providing Twilio Account SID + Auth Token. Retell re-configures the Twilio number's webhook automatically.
3. Store the Retell `phone_number_id` and the raw Twilio number in your DB.
4. When a contractor's forwarded call arrives, Retell fires a `call.started` webhook to your server.

**What NOT to do:** Do not use raw Twilio TwiML to forward to Retell SIP directly — this path exists but requires manual SIP trunk configuration and is error-prone. Use the Retell-managed Twilio import instead.

### Webhook Handling

All Retell events arrive at a single endpoint. Retell signs webhooks with a shared secret; verify the signature before processing.

```typescript
// app/api/retell/webhook/route.ts
import { RetellWebhookParser } from "retell-sdk";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature") ?? "";

  const valid = RetellWebhookParser.verifySignature(
    rawBody,
    signature,
    process.env.RETELL_WEBHOOK_SECRET!
  );
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const event = JSON.parse(rawBody);

  switch (event.event) {
    case "call_started":   await handleCallStarted(event.data); break;
    case "call_ended":     await handleCallEnded(event.data); break;
    case "call_analyzed":  await handleCallAnalyzed(event.data); break;
    // custom_tool_called fires for book_appointment / send_emergency_alert:
    case "custom_tool_called": await handleToolCall(event.data); break;
  }

  return new Response("OK", { status: 200 });
}
```

**Critical:** Return 200 within 10 seconds or Retell retries. For heavy work (DB writes, Calendar API calls), enqueue a background job and return 200 immediately. See "Background Jobs" section below.

### call_analyzed Event

This event fires 1–3 minutes after the call ends and contains the transcript, sentiment, summary, and custom data extracted by the LLM. This is the canonical source for lead qualification results — do not try to parse transcript in real time from `call_ended`.

### Retell Custom Tools (Function Calling)

Custom tools are the mechanism for Retell's LLM to call your API mid-conversation:

```json
{
  "type": "custom",
  "name": "book_appointment",
  "description": "Book an appointment in Google Calendar after caller confirms date/time",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_name": { "type": "string" },
      "service_type": { "type": "string", "enum": ["hvac", "plumbing", "electrical"] },
      "preferred_date": { "type": "string", "format": "date" },
      "preferred_time": { "type": "string" },
      "address": { "type": "string" },
      "phone": { "type": "string" }
    },
    "required": ["caller_name", "service_type", "preferred_date", "preferred_time"]
  }
}
```

Your webhook receives `custom_tool_called` and must respond with tool output within 10 seconds. Book the Calendar event synchronously in the webhook handler (Calendar API is fast enough).

---

## 2. Twilio

**Confidence: HIGH** — Twilio's Node SDK and number provisioning APIs are stable and well-documented.

```bash
npm install twilio              # @latest, currently 5.x
```

### Number Provisioning (Onboarding Flow)

```typescript
import Twilio from "twilio";
const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Search for available numbers in contractor's area code
const numbers = await client.availablePhoneNumbers("US")
  .local.list({ areaCode: contractor.areaCode, limit: 5 });

// Purchase first available
const purchased = await client.incomingPhoneNumbers.create({
  phoneNumber: numbers[0].phoneNumber,
});
// Store purchased.sid and purchased.phoneNumber in DB
// Then import into Retell (see Retell section)
```

### SMS Notifications (Fallback)

```typescript
await client.messages.create({
  from: process.env.TWILIO_SENDERS_NUMBER!,
  to: contractor.phone,
  body: `New lead from ${callerName}: ${summary}`,
});
```

### WhatsApp via Twilio

Use Twilio's WhatsApp sandbox for development, then upgrade to a WhatsApp Business account. This avoids managing the Meta WhatsApp Business API directly.

```typescript
await client.messages.create({
  from: "whatsapp:+14155238886",   // Twilio sandbox number; replace with approved sender
  to: `whatsapp:${contractor.whatsappNumber}`,
  body: message,
});
```

**Limitation:** Twilio WhatsApp requires contractors to opt in (send a message to your sandbox number first) during development. In production, you need a Meta-approved WhatsApp Business number — apply via Twilio console, not directly via Meta. Approval takes 2–5 business days.

**What NOT to use:** Direct Meta Cloud API for WhatsApp (requires business verification, app review, and significantly more setup). For a solo/small team, Twilio WhatsApp is the correct choice.

---

## 3. Supabase

**Confidence: HIGH** — Supabase schema design patterns are stable and well-established.

```bash
npm install @supabase/supabase-js @supabase/ssr   # ssr package for Next.js App Router
```

### Authentication

Use Supabase Auth with email + password for the contractor portal. Do NOT implement custom JWT handling — use Supabase's built-in session management.

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: "", ...options }),
      },
    }
  );
}
```

**Critical note on @supabase/ssr vs @supabase/auth-helpers-nextjs:** The `auth-helpers-nextjs` package is deprecated. Use `@supabase/ssr` for all new App Router projects.

### Core Schema

```sql
-- Contractors (1 row per paying customer)
create table contractors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  phone        text not null,           -- contractor's real cell for notifications
  area_code    text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'trialing',  -- trialing | active | past_due | canceled
  created_at   timestamptz default now(),
  unique(user_id)
);

-- Retell agent config per contractor
create table agent_configs (
  id                uuid primary key default gen_random_uuid(),
  contractor_id     uuid not null references contractors(id) on delete cascade,
  retell_agent_id   text not null,
  retell_llm_id     text not null,
  twilio_number     text not null,       -- e.g. +15551234567
  twilio_number_sid text not null,
  services_offered  text[] not null default '{}',
  business_hours    jsonb not null default '{}',  -- {mon: {open: "08:00", close: "18:00"}, ...}
  emergency_keywords text[] not null default '{flood,gas leak,no heat,no ac,emergency}',
  notification_channels jsonb not null default '{}',  -- {whatsapp: "+1...", telegram: "123456", sms: "+1..."}
  is_active         boolean default false,
  updated_at        timestamptz default now(),
  unique(contractor_id)
);

-- One row per inbound call
create table calls (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references contractors(id),
  retell_call_id  text not null unique,
  caller_phone    text,
  direction       text default 'inbound',
  status          text not null,       -- in_progress | ended | error
  start_time      timestamptz,
  end_time        timestamptz,
  duration_seconds int,
  recording_url   text,
  transcript      text,
  summary         text,               -- populated by call_analyzed
  sentiment       text,               -- positive | neutral | negative
  call_type       text,               -- lead | emergency | existing_customer | spam
  created_at      timestamptz default now()
);

-- Qualified leads extracted from calls
create table leads (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references contractors(id),
  call_id         uuid references calls(id),
  caller_name     text,
  caller_phone    text not null,
  service_type    text,               -- hvac | plumbing | electrical | general
  description     text,               -- problem description from transcript
  is_emergency    boolean default false,
  status          text default 'new', -- new | contacted | booked | lost
  created_at      timestamptz default now()
);

-- Calendar appointments booked during calls
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references contractors(id),
  lead_id         uuid references leads(id),
  call_id         uuid references calls(id),
  google_event_id text not null,
  calendar_id     text not null,
  scheduled_at    timestamptz not null,
  duration_minutes int default 60,
  service_address text,
  notes           text,
  created_at      timestamptz default now()
);

-- Google OAuth tokens per contractor
create table google_oauth_tokens (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references contractors(id) on delete cascade,
  access_token    text not null,
  refresh_token   text not null,      -- ENCRYPT this column at application level
  expires_at      timestamptz not null,
  scope           text not null,
  updated_at      timestamptz default now(),
  unique(contractor_id)
);
```

**Row-Level Security (RLS) — mandatory:**

```sql
alter table contractors enable row level security;
alter table calls enable row level security;
alter table leads enable row level security;
alter table appointments enable row level security;
alter table agent_configs enable row level security;
alter table google_oauth_tokens enable row level security;

-- Contractors only see their own data (pattern applies to all tables)
create policy "contractors_own_data" on calls
  for all using (
    contractor_id = (
      select id from contractors where user_id = auth.uid()
    )
  );
```

**What NOT to do:** Do not disable RLS for speed during development and plan to add it later — it is far easier to enable from day one than retrofit.

### Real-time Subscriptions (Portal)

Use Supabase Realtime to push new call rows to the portal without polling:

```typescript
supabase
  .channel("calls")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "calls",
    filter: `contractor_id=eq.${contractorId}`,
  }, (payload) => updateCallList(payload.new))
  .subscribe();
```

Enable Realtime in Supabase dashboard for the `calls` and `leads` tables only (not `google_oauth_tokens`).

---

## 4. Google Calendar OAuth

**Confidence: HIGH** — Google OAuth + Calendar API is mature and well-documented. The patterns below are stable.

```bash
npm install googleapis          # google-apis Node.js client, currently v140+
```

### OAuth Flow (Next.js App Router)

This is a server-side OAuth flow. Never expose client secrets to the browser.

```typescript
// app/api/google/auth/route.ts — initiates OAuth
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
);

export function GET() {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",      // CRITICAL: must be offline to get refresh_token
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    prompt: "consent",           // CRITICAL: forces refresh_token on every grant
  });
  return Response.redirect(url);
}

// app/api/google/callback/route.ts — receives code, stores tokens
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")!;
  const { tokens } = await oauth2Client.getToken(code);
  // Store tokens.access_token, tokens.refresh_token, tokens.expiry_date in DB
  // Encrypt refresh_token before storing (use libsodium or node:crypto)
}
```

**Critical gotchas:**

1. `access_type: "offline"` is required to receive a `refresh_token`. Without it you only get an access token valid for 1 hour.
2. `prompt: "consent"` forces a new `refresh_token` every time the user reconnects. Without it, Google only returns a refresh token on the first grant — subsequent re-authorizations return no refresh token, which means reconnections silently fail.
3. Google revokes refresh tokens after ~6 months of inactivity OR when the user has more than 50 refresh tokens for your app. Handle token refresh errors by re-initiating OAuth.

### Token Refresh Pattern

```typescript
async function getCalendarClient(contractorId: string) {
  const record = await getOAuthTokens(contractorId);
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
  client.setCredentials({
    access_token: decrypt(record.access_token),
    refresh_token: decrypt(record.refresh_token),
    expiry_date: new Date(record.expires_at).getTime(),
  });
  // googleapis auto-refreshes when token is expired
  client.on("tokens", async (tokens) => {
    // Persist new access_token (and refresh_token if provided)
    await updateOAuthTokens(contractorId, tokens);
  });
  return google.calendar({ version: "v3", auth: client });
}
```

### Creating Calendar Events

```typescript
const calendar = await getCalendarClient(contractorId);
const event = await calendar.events.insert({
  calendarId: "primary",
  requestBody: {
    summary: `${serviceType} estimate — ${callerName}`,
    description: `Phone: ${callerPhone}\nIssue: ${description}`,
    start: { dateTime: isoDateTime, timeZone: contractor.timezone },
    end:   { dateTime: isoEndTime,  timeZone: contractor.timezone },
    attendees: [{ email: contractor.email }],
    reminders: { useDefault: true },
  },
});
return event.data.id; // store as google_event_id
```

**What NOT to use:** The `google-auth-library` package alone (without `googleapis`) — it handles OAuth but not the Calendar API resource methods. Use `googleapis` which bundles `google-auth-library`.

---

## 5. WhatsApp Business API

**Confidence: MEDIUM** — Twilio WhatsApp is the correct choice for a solo/small team. Meta Cloud API is viable but operationally heavier.

### Decision: Twilio WhatsApp (not Meta Cloud API directly)

| Factor | Twilio WhatsApp | Meta Cloud API |
|--------|----------------|----------------|
| Setup complexity | Low (1 Twilio account) | High (Meta Business Manager, app review) |
| Approval time | ~5 business days | 1–3 weeks |
| Per-message cost | ~$0.005–$0.015 (Twilio markup) | ~$0.005 (Meta rate) |
| Rate limits | Managed by Twilio | Must manage yourself |
| Recommended for solo builder | YES | NO |

The Twilio markup (~2x Meta's rate) is worth it in v1 to avoid Meta's business verification overhead. Re-evaluate after PMF.

### Implementation

Already covered in section 2 (Twilio). The critical production step is applying for a **WhatsApp Business sender** in the Twilio console after your business entity is registered (Stripe Atlas incorporation covers this). Do this in week 1 of build so approval doesn't block launch.

### Template Messages (Production Requirement)

In production, WhatsApp requires pre-approved templates for outbound messages sent to users who have not messaged you in the last 24 hours. For VoiceDesk notifications, this means:

```
Template name: new_lead_alert
Body: "New lead from {{1}}: {{2}}. Service: {{3}}. Call back: {{4}}"
```

Submit templates via Twilio console. Approval takes 24–48 hours. Build the template IDs into your notification code.

**What NOT to do:** Do not try to send free-form WhatsApp messages to contractors who haven't opted in within 24 hours — messages will be silently dropped or your account flagged.

---

## 6. Telegram Bot API

**Confidence: HIGH** — Telegram Bot API is stable, free, and requires no business verification.

```bash
npm install node-telegram-bot-api   # OR grammy (preferred — better TypeScript)
npm install grammy                  # recommended — modern, typed, actively maintained
```

### Recommendation: grammY over node-telegram-bot-api

grammY is the modern Telegram bot framework with first-class TypeScript support, webhook middleware compatible with Next.js Route Handlers, and active maintenance. `node-telegram-bot-api` is legacy.

### Setup Pattern

```typescript
// lib/telegram.ts
import { Bot } from "grammy";

// VoiceDesk's own bot — one bot for the entire platform
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

export async function sendTelegramNotification(
  chatId: string,   // contractor's personal chat ID
  message: string
) {
  await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
}
```

**Onboarding flow for Telegram:**

1. Contractor clicks "Connect Telegram" in portal.
2. Show them a link: `https://t.me/VoiceDeskBot?start=<contractor_id>`.
3. When contractor opens that link, Telegram sends a `/start <contractor_id>` command to your bot.
4. Webhook receives the message; extract `chatId` and `contractor_id`; store `chatId` in `agent_configs.notification_channels`.

```typescript
// app/api/telegram/webhook/route.ts
export async function POST(req: Request) {
  const update = await req.json();
  if (update.message?.text?.startsWith("/start ")) {
    const contractorId = update.message.text.split(" ")[1];
    const chatId = String(update.message.chat.id);
    await linkTelegramToContractor(contractorId, chatId);
    await bot.api.sendMessage(chatId,
      "Telegram connected! You'll receive lead alerts here."
    );
  }
  return new Response("OK");
}
```

**What NOT to do:** Do not use polling mode (`bot.start()`) in a serverless/Vercel deployment — it requires a persistent process. Use webhooks exclusively.

---

## 7. Stripe Subscription Billing

**Confidence: HIGH** — Stripe's subscription API and webhook patterns are well-established.

```bash
npm install stripe @stripe/stripe-js
```

### Product / Price Setup (One-time Dashboard Config)

Create two products in Stripe Dashboard:

| Product | Price ID env var | Price | Features |
|---------|-----------------|-------|---------|
| Starter | `STRIPE_PRICE_STARTER` | $299/mo | 1 number, 500 min/mo included |
| Pro | `STRIPE_PRICE_PRO` | $799/mo | 3 numbers, unlimited min (fair use) |

### Checkout Flow

Use Stripe Checkout (hosted page) rather than Stripe Elements for v1 — no PCI scope, zero UI to build.

```typescript
// app/api/billing/checkout/route.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",    // pin to specific version — do NOT use "latest"
});

export async function POST(req: Request) {
  const { priceId, contractorId } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: contractor.stripeCustomerId ?? undefined,  // re-use if exists
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=success`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { contractorId },
    subscription_data: {
      trial_period_days: 14,   // 14-day free trial
      metadata: { contractorId },
    },
  });
  return Response.json({ url: session.url });
}
```

### Webhook Handling

```typescript
// app/api/billing/webhook/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      // First subscription created — provision phone number, create Retell agent
      await provisionContractor(event.data.object);
      break;
    case "customer.subscription.updated":
      await updateSubscriptionStatus(event.data.object);
      break;
    case "customer.subscription.deleted":
      // Deactivate agent, release Twilio number (or hold for grace period)
      await deactivateContractor(event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailure(event.data.object);
      break;
  }
  return new Response("OK");
}
```

**What NOT to do:**

- Do not use `apiVersion: "latest"` in production — Stripe silently changes behavior on version bumps.
- Do not do provisioning work synchronously in the checkout redirect — use the `checkout.session.completed` webhook as the canonical trigger.
- Do not store raw credit card data anywhere — Stripe Checkout handles all of this.

### Customer Portal (Billing Management)

Enable Stripe Customer Portal in Dashboard. Expose one server action to redirect to it:

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: contractor.stripeCustomerId,
  return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
});
return Response.redirect(session.url);
```

---

## 8. Background Jobs and Queues

**Confidence: MEDIUM** — This is the most common gap in voice AI SaaS architectures. Ignoring this causes silent data loss.

### The Problem

Retell webhooks must receive a 200 response within 10 seconds. But `call_analyzed` triggers work that can take longer:

- Writing call summary + transcript to DB
- Sending WhatsApp + Telegram + SMS notifications (3 external API calls)
- Creating/updating lead records

If any of these fail or timeout, Retell retries — potentially duplicating records or sending duplicate notifications.

### Recommendation: Supabase Edge Functions + Supabase pgmq (or Inngest)

**Option A — Inngest (recommended for Vercel + Next.js)**

```bash
npm install inngest
```

Inngest integrates natively with Vercel, handles retries, deduplication, and durable execution with zero infrastructure. It has a generous free tier (50K function runs/month).

```typescript
// inngest/functions/process-call-analyzed.ts
import { inngest } from "@/lib/inngest";

export const processCallAnalyzed = inngest.createFunction(
  { id: "process-call-analyzed", retries: 3 },
  { event: "retell/call.analyzed" },
  async ({ event, step }) => {
    const { callId, contractorId, transcript, summary, callType } = event.data;

    await step.run("save-call-record", () =>
      saveCallToDatabase(callId, transcript, summary)
    );

    if (callType === "lead" || callType === "emergency") {
      await step.run("create-lead", () => createLeadRecord(event.data));
      await step.run("send-notifications", () =>
        sendAllNotifications(contractorId, event.data)
      );
    }
  }
);

// Webhook handler — fires event and returns 200 immediately
export async function POST(req: Request) {
  // ... verify signature ...
  await inngest.send({ name: "retell/call.analyzed", data: event.data });
  return new Response("OK"); // returns in <100ms
}
```

**Option B — Supabase Database Functions + pg_cron**

Use Supabase's `pg_cron` extension to run cleanup/retry jobs. Simpler but less real-time and harder to debug.

**What NOT to do:** Do not write all processing logic synchronously in the Retell webhook handler. One slow Twilio API call will cause the webhook to timeout, triggering Retell retries and duplicate processing.

---

## 9. Supporting Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | ^3.x | Runtime schema validation | Validate all webhook payloads before processing |
| `date-fns` | ^3.x | Date/time manipulation | Prefer over moment.js (smaller, tree-shakeable) |
| `date-fns-tz` | ^3.x | Timezone handling | Critical for appointment booking across timezones |
| `libphonenumber-js` | ^1.x | Phone number parsing/formatting | Normalize caller phone before storing |
| `@tanstack/react-query` | ^5.x | Server state in portal | Pair with Supabase Realtime for optimistic updates |
| `react-hook-form` | ^7.x | Form handling | Agent configuration forms |
| `tailwindcss` | ^3.x | Styling | Ship UI fast; works with shadcn/ui |
| `shadcn/ui` | latest | Component library | Built on Radix UI + Tailwind; copy-paste components |
| `recharts` | ^2.x | Call analytics charts | Lightweight; sufficient for portal dashboards |

---

## 10. Environment Variables

Full `.env.local` surface area:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only; never expose to browser

# Retell
RETELL_API_KEY=
RETELL_WEBHOOK_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=               # whatsapp:+14155238886

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=                # https://yourdomain.com/api/google/callback

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=               # price_xxx
STRIPE_PRICE_PRO=                   # price_xxx

# Telegram
TELEGRAM_BOT_TOKEN=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=                # https://voicedesk.ai
ENCRYPTION_KEY=                     # 32-byte hex key for OAuth token encryption
```

---

## 11. What the Chosen Stack Is Missing

The following are gaps not covered by the stated tech decisions:

| Gap | Severity | Recommendation |
|-----|----------|---------------|
| Background job queue | HIGH | Add Inngest (free tier covers v1 volume) |
| Google OAuth token encryption | HIGH | Add `node:crypto` AES-256-GCM; store ENCRYPTION_KEY in env |
| Phone number normalization | MEDIUM | Add `libphonenumber-js` to avoid duplicate lead records from same caller |
| Timezone handling for appointments | MEDIUM | Add `date-fns-tz`; contractor must set their timezone during onboarding |
| Webhook idempotency | MEDIUM | Store `retell_call_id` as UNIQUE; catch duplicate insert errors gracefully |
| Stripe metered billing for overages | LOW | Defer to v2; charge flat rate in v1 |
| Rate limiting on webhook endpoints | LOW | Vercel Edge Middleware + `@upstash/ratelimit` if Upstash Redis is added |
| Error monitoring | MEDIUM | Add Sentry free tier — `@sentry/nextjs`; voice AI bugs are hard to reproduce without traces |

---

## 12. Alternatives Rejected

| Category | Recommended | Rejected | Why Rejected |
|----------|-------------|----------|-------------|
| Voice AI | Retell | Vapi | Higher latency; Retell chosen explicitly |
| Background jobs | Inngest | BullMQ / Redis | Requires Redis infra; Inngest is serverless-native |
| WhatsApp | Twilio WhatsApp | Meta Cloud API | Business verification overhead; slower to ship |
| DB | Supabase | PlanetScale / Neon | Supabase chosen explicitly; covers auth + realtime + DB |
| Auth | Supabase Auth | Auth0 / Clerk | Redundant with Supabase; Auth0/Clerk add cost and complexity |
| Telegram | grammY | node-telegram-bot-api | Legacy; grammY has better TypeScript and active maintenance |
| Calendar | googleapis | @googleapis/calendar | Full `googleapis` preferred — bundles auth client |
| Styling | Tailwind + shadcn | MUI / Chakra | Heavier bundles; shadcn is copy-paste, no version conflicts |

---

## Sources

- Retell AI documentation (https://docs.retellai.com) — training data through August 2025; live verification blocked this session
- Twilio Node.js SDK docs (https://www.twilio.com/docs/libraries/node) — HIGH confidence, stable API
- Supabase docs: App Router integration (https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence
- Google Identity: OAuth 2.0 for Web Server Applications (https://developers.google.com/identity/protocols/oauth2/web-server) — HIGH confidence
- Stripe API Reference 2024-06-20 (https://stripe.com/docs/api) — HIGH confidence
- Telegram Bot API (https://core.telegram.org/bots/api) — HIGH confidence, stable
- grammY docs (https://grammy.dev) — MEDIUM confidence, verified through training data
- Inngest docs (https://www.inngest.com/docs) — MEDIUM confidence
- WhatsApp Business API / Twilio WhatsApp (https://www.twilio.com/en-us/whatsapp) — MEDIUM confidence on template requirement specifics

**Confidence summary by area:**

| Area | Confidence | Reason |
|------|------------|--------|
| Retell API patterns | MEDIUM | Live docs blocked; training data covers v2 API but webhook signature method name may differ slightly |
| Twilio | HIGH | Stable API, well-established patterns |
| Supabase schema | HIGH | Patterns are standard; @supabase/ssr deprecation of auth-helpers confirmed |
| Google Calendar OAuth | HIGH | Stable API; refresh_token gotchas are documented industry-wide |
| WhatsApp template requirement | MEDIUM | Policy details may have shifted; verify template approval process via Twilio console |
| Telegram / grammY | HIGH | Stable Bot API; grammY recommendation verified |
| Stripe | HIGH | Stable API; version pinning is confirmed best practice |
| Inngest / background jobs | MEDIUM | Product is actively developed; verify free tier limits before commit |
