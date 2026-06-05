<!-- generated-by: gsd-doc-writer -->

# Development

This guide covers the development workflow for Koolable: local setup, project structure, testing patterns, API routes, database migrations, and commit conventions.

## Local Setup

### Prerequisites

- Node.js >= 18.0.0 (check with `node --version`)
- npm (installed with Node.js)
- Git
- Vercel CLI (optional, for testing production builds): `npm install -g vercel`

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/koolable.git
   cd koolable
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure required secrets in `.env.local`:**
   For Phase 1 development, set minimum variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
   - `OAUTH_ENCRYPTION_KEY` — 64-char hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   
   For phases 2+, add API keys as they become needed (see [CONFIGURATION.md](CONFIGURATION.md) for full list).

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   Server runs at `http://localhost:3000`. Hot reload is enabled; changes are reflected immediately.

6. **For webhook testing with local tunneling:**
   ```bash
   npm install -g ngrok
   ngrok http 3000
   # Copy the HTTPS URL (e.g., https://xxxx.ngrok-free.app)
   # Set APP_URL=https://xxxx.ngrok-free.app in .env.local
   # Restart dev server: npm run dev
   ```

### Database Setup (Local)

For local development with a full database, use Supabase local stack:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (requires Docker)
supabase start

# Apply migrations to local database
supabase migration up
```

For remote Supabase (easier): point `NEXT_PUBLIC_SUPABASE_URL` and keys to your dev Supabase project, then migrations run automatically via `npm run dev` (if using Vercel integration) or manually via `supabase migration up --linked`.

## Project Structure

```
src/
├── app/
│   ├── (auth)/                # Auth pages: login, signup, password reset
│   ├── (dashboard)/           # Authenticated portal: calls, leads, settings
│   ├── api/
│   │   ├── auth/              # Auth endpoints
│   │   ├── webhooks/          # External webhooks (Retell, Stripe, Telegram)
│   │   │   ├── retell/        # POST handler for Retell call_ended, call_analyzed
│   │   │   ├── stripe/        # POST handler for Stripe billing events
│   │   │   └── telegram/      # POST handler for Telegram messages
│   │   ├── provisioning/      # Agent + Twilio number provisioning
│   │   ├── notifications/     # Portal notification APIs
│   │   ├── contractor/        # Contractor profile + status
│   │   ├── subscription/      # Subscription management
│   │   └── ...                # Other internal APIs
│   ├── layout.tsx             # Root layout + theme provider
│   └── page.tsx               # Redirect to dashboard
├── components/                # Reusable React components (Radix UI + Tailwind)
├── contexts/                  # React contexts (contractor, theme, etc.)
├── inngest/
│   ├── client.ts              # Inngest client singleton
│   └── functions/             # Durable job functions
│       ├── retell-call-classify.ts
│       ├── retell-notify-dispatch.ts
│       ├── retell-agent-sync.ts
│       ├── stripe-payment-failure.ts
│       └── retell-analysis-timeout.ts
├── lib/
│   ├── after-hours/           # Business hours detection
│   ├── classification/        # Intent + trade data extraction (OpenAI)
│   ├── crypto/                # Token encryption/decryption (AES-256-GCM)
│   ├── google/                # Google Calendar API integration
│   ├── notifications/         # Multi-channel senders (SMS, WhatsApp, Telegram, Email)
│   ├── openai/                # OpenAI client + prompts
│   ├── query/                 # Database query helpers
│   ├── realtime/              # Supabase Realtime subscriptions (React hooks)
│   ├── retell/                # Retell SDK client + webhook types
│   ├── scheduling/            # Calendar slot computation
│   ├── stripe/                # Stripe API client
│   ├── supabase/              # Supabase clients (service-role + browser)
│   ├── theme/                 # Theme provider + useTheme hook
│   ├── validations/           # Zod schemas for forms and API validation
│   └── utils.ts               # Utilities (cn() for Tailwind classname merging)
├── types/
│   ├── database.ts            # TypeScript types auto-generated from Supabase schema
│   └── stripe.ts              # Stripe types
└── middleware.ts              # Next.js middleware (auth state management)

tests/
├── setup.ts                   # Vitest setup, env loading
├── __mocks__/                 # Mock implementations (server-only, crypto)
├── api/                       # API route tests
├── inngest/                   # Inngest function tests
├── db/                        # Database integration tests
├── lib/                       # Library function unit tests
├── components/                # Component tests
└── auth.spec.ts               # Authentication flow tests

supabase/
├── migrations/                # SQL migration files (numbered chronologically)
│   ├── 20260504000001_initial_schema.sql
│   ├── 20260504000002_rls_policies.sql
│   └── ...
└── config.toml                # Supabase local development config
```

**Key Design Principles:**
- `lib/` contains pure business logic, testable without Next.js.
- `app/` contains routes and Server Components; minimal logic here.
- `components/` are Client Components (React 19 "use client") for interactivity.
- `inngest/functions/` are isolated, durable job definitions.
- `tests/` mirrors `src/` structure for easy navigation.

## TDD Workflow

Follow strict Test-Driven Development:

### 1. Red → Green → Refactor

```bash
# Red: Write a failing test
npm run test:watch

# In your editor: write a test that fails
# Example: tests/lib/classification/classify-intent.test.ts
import { describe, it, expect } from 'vitest'
import { classifyIntent } from '@/lib/classification/classify-intent'

describe('classifyIntent', () => {
  it('should classify "I need a plumber" as lead', async () => {
    const result = await classifyIntent('I need a plumber for a burst pipe', 'en')
    expect(result.intent).toBe('lead')
  })
})

# Green: Write minimal implementation to make it pass
# Then refactor both test and implementation to be clean

# Watch mode continuously re-runs tests as you save
```

### 2. Unit vs Integration Tests

**Unit tests** (jsdom environment):
- Test pure functions: classification, encryption, formatting
- Mock external APIs (Supabase, OpenAI, Google)
- Located in `tests/lib/`, `tests/utils.ts`

```typescript
// Example: unit test
import { classifyIntent } from '@/lib/classification/classify-intent'
import { describe, it, expect, vi } from 'vitest'

describe('classifyIntent', () => {
  it('should parse GPT response correctly', async () => {
    // Mock OpenAI client
    vi.mock('@/lib/openai/client', () => ({
      openai: { chat: { completions: { create: vi.fn(() => ({
        choices: [{ message: { content: '{"intent":"lead"}' } }]
      })) } } }
    }))

    const result = await classifyIntent('call transcript', 'en')
    expect(result.intent).toBe('lead')
  })
})
```

**Integration tests** (node environment, real Supabase):
- Test API routes with real database
- Test webhook signature verification
- Test Inngest job execution
- Located in `tests/api/`, `tests/db/`, `tests/inngest/`

```typescript
// Example: integration test (uses real .env.test credentials)
import { POST } from '@/app/api/webhooks/retell/route'
import { describe, it, expect } from 'vitest'

describe('POST /api/webhooks/retell', () => {
  it('should reject unsigned webhook with 401', async () => {
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'x-retell-signature': 'invalid' },
      body: '{"event":"call_ended"}',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
```

### 3. Running Tests

```bash
# Run all tests once (unit + integration)
npm run test

# Run tests in watch mode (auto-rerun on save)
npm run test:watch

# Run tests matching a pattern
npm run test -- classification

# Run with coverage
npm run test -- --coverage
```

**Coverage thresholds** (enforced in CI):
- **Lines:** 80%
- **Branches:** 75%
- **Functions:** 80%
- **Statements:** 80%

If coverage is too low, add tests before committing:
```bash
npm run test -- --coverage
# Review coverage report in terminal or open coverage/index.html
```

### 4. Server-Only Code in Tests

The `server-only` package throws in non-Node.js environments. For testing server-only modules:

```typescript
// vitest.config.ts already mocks 'server-only' → tests/__mocks__/server-only.ts
// This means you can import and test functions marked with `import 'server-only'`

import { createServiceRoleClient } from '@/lib/supabase/service' // Has 'server-only' at top
import { describe, it } from 'vitest'

// This works in Vitest (mocked), but would fail at runtime in browser
describe('createServiceRoleClient', () => {
  it('returns a Supabase client', () => {
    const client = createServiceRoleClient()
    expect(client).toBeDefined()
  })
})
```

## API Route Patterns

### Route Structure

All API routes follow a consistent pattern:

```typescript
// src/app/api/[feature]/[action]/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { someSchema } from '@/lib/validations/schemas'
import 'server-only'

export async function POST(req: Request) {
  // 1. Authenticate (if needed)
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = someSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  // 3. Execute business logic
  const serviceClient = createServiceRoleClient() // Service role for privileged operations
  const { data, error } = await serviceClient
    .from('table')
    .insert(parsed.data)
  if (error) {
    console.error('[route] insert failed:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // 4. Return response
  return NextResponse.json({ success: true, data })
}
```

### Validation with Zod

All request/response validation uses [Zod](https://zod.dev):

```typescript
// lib/validations/onboarding.ts
import { z } from 'zod'

export const phoneSchema = z.object({
  phone_number: z.string().min(10).max(15),
  business_name: z.string().min(1).max(100),
  area_code: z.string().optional(),
})

export type PhoneSchemaType = z.infer<typeof phoneSchema>
```

Use in routes:
```typescript
const parsed = phoneSchema.safeParse(req.body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
}
```

### Error Handling

**Rules:**
- Return appropriate HTTP status codes (400 for bad input, 401 for auth, 500 for server errors)
- Log errors with context (route, user, timestamp)
- Never expose internal error details to the client
- Always return a JSON response

```typescript
// Good error handling
export async function POST(req: Request) {
  try {
    const data = await processRequest(req)
    return NextResponse.json(data)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[route]', JSON.stringify({ error: errorMsg, path: req.url }))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Webhook Handlers

Webhook handlers (Retell, Stripe, Telegram) follow a special pattern:

**1. Verify signature immediately (before parsing payload):**
```typescript
const rawBody = await req.text() // Must call before req.json()
const signature = req.headers.get('x-retell-signature') ?? ''
const { valid } = verifyRetellHmac(rawBody, apiKey, signature)
if (!valid) return new Response('Unauthorized', { status: 401 })
```

**2. Parse body after verification:**
```typescript
const event = JSON.parse(rawBody) as RetellWebhookEvent
```

**3. Return 200 immediately (critical architecture rule):**
```typescript
// DO NOT block on downstream work — return immediately
after(async () => {
  // All processing deferred to Vercel's request deferred context
  try {
    await processEvent(event)
  } catch (err) {
    console.error('[webhook] processing failed:', err)
  }
})
return new Response('OK', { status: 200 })
```

This ensures Retell/Stripe can retry reliably if the webhook provider times out. See `src/app/api/webhooks/retell/route.ts` for the complete pattern.

## Supabase Patterns

### Client Setup

Two Supabase clients:

**Service-role client (server-only, for privileged operations):**
```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  )
}
```

Used in:
- API routes (webhook handlers, provisioning, etc.)
- Inngest functions
- Server Components that need to bypass RLS

**Browser client (anon key, respects RLS):**
```typescript
// lib/supabase/client.ts (Client Component safe)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createSupabaseBrowser() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Used in:
- Client Components (after clicking "Sign in")
- useQuery hooks for fetching data

**Server-side client (uses SSR helper):**
```typescript
// lib/supabase/server.ts (Server Components only)
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseServer() {
  const cookies = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  )
}
```

Used in:
- Server Components (layout, page)
- Server Actions

### Row-Level Security (RLS)

Every table has RLS enabled with policies:

**Pattern A — Direct user_id (contractors table):**
```sql
CREATE POLICY "Contractors: users can read/modify their own" ON contractors
  FOR ALL USING ((SELECT auth.uid()) = user_id);
```

**Pattern B — Foreign key to contractors (calls, leads, etc.):**
```sql
CREATE POLICY "Calls: users can access own contractor calls" ON calls
  FOR ALL USING (
    contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))
  );
```

**Pattern C — Webhook events (deny all, service-role only):**
```sql
CREATE POLICY "webhook_events: deny authenticated users" ON webhook_events
  FOR ALL USING (false);
```

**Testing RLS locally:**
```bash
# Seed test fixtures (creates test user + contractor)
npx tsx scripts/seed-rls-test-fixtures.ts

# Copy JWT + contractor_id from output → .env.test
# npm run test (uses .env.test JWT for all test queries)
```

### Migrations

Migrations define schema + RLS policies:

```bash
# Create a new migration
supabase migration new add_new_table
# Edit supabase/migrations/2026MMDD000NNN_add_new_table.sql

# Example migration
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id) -- Constraint to ensure data integrity
);

-- RLS: contractor can read/modify their own rows
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own contractor data" ON new_feature
  FOR ALL USING (
    contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))
  );

-- Index for query performance
CREATE INDEX idx_new_feature_contractor_id ON new_feature(contractor_id);

-- Apply migration
supabase migration up
```

**Safety checks before deploy:**
1. RLS enabled on all new tables
2. All four operations (SELECT, INSERT, UPDATE, DELETE) have policies
3. Policies tested as unprivileged user: `npm run test`
4. Foreign key constraints prevent orphaned rows (ON DELETE CASCADE)
5. Indexes on frequently filtered columns (contractor_id, status, etc.)

## React/Next.js Server Components

### When to Use Server Components

**Use Server Components when:**
- Loading data directly (no client-side state needed)
- Accessing secrets (API keys, service-role client)
- Performing database writes with RLS

```typescript
// app/(dashboard)/calls/page.tsx — Server Component
import { createSupabaseServer } from '@/lib/supabase/server'

export default async function CallsPage() {
  const supabase = await createSupabaseServer()
  const { data: calls } = await supabase.from('calls').select()

  return (
    <div>
      <h1>Calls</h1>
      <CallTable calls={calls ?? []} /> {/* Pass to Client Component for interactivity */}
    </div>
  )
}
```

**Use Client Components when:**
- Handling user interactions (forms, buttons, filters)
- Using hooks (useState, useEffect, useQuery)
- Styling with interactive effects (hover, animations)

```typescript
// components/CallTable.tsx — Client Component
'use client'

import { useState } from 'react'
import type { Call } from '@/types/database'

interface CallTableProps {
  calls: Call[]
}

export function CallTable({ calls }: CallTableProps) {
  const [filter, setFilter] = useState('')

  const filtered = calls.filter(c => c.id.includes(filter))

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by call ID"
      />
      <table>
        <tbody>
          {filtered.map(call => <tr key={call.id}>{/* render */}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
```

### Data Fetching with React Query

For real-time data or polling in Client Components:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

export function CallMetrics() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metrics')
      return res.json()
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  return <div>Calls today: {metrics.count}</div>
}
```

## Retell Webhook Patterns

### Event Flow

1. Customer calls Twilio number → Retell agent answers
2. Call completes → Retell sends two webhooks: `call_ended`, then `call_analyzed`
3. Both POST to `/api/webhooks/retell` with HMAC-SHA256 signature
4. Handler verifies signature, creates/updates call row, queues Inngest job

### Handler Structure

```typescript
// src/app/api/webhooks/retell/route.ts
import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { processCallEnded, processCallAnalyzed } from './handlers'

function verifyRetellHmac(rawBody: string, apiKey: string, signature: string) {
  // HMAC verification logic
  // Returns { valid: boolean, diagnostics: object }
}

export async function POST(req: Request) {
  const retellWebhookKey = process.env.RETELL_WEBHOOK_KEY
  if (!retellWebhookKey) return new Response('Error', { status: 500 })

  const rawBody = await req.text() // MUST be before req.json()
  const signature = req.headers.get('x-retell-signature') ?? ''

  // Verify signature BEFORE parsing
  const { valid } = verifyRetellHmac(rawBody, retellWebhookKey, signature)
  if (!valid) return new Response('Unauthorized', { status: 401 })

  // Parse after verification
  const event = JSON.parse(rawBody) as RetellWebhookEvent

  // Return 200 immediately — all work deferred
  after(async () => {
    try {
      if (event.event === 'call_ended') {
        await processCallEnded(event.call)
      } else if (event.event === 'call_analyzed') {
        await processCallAnalyzed(event.call)
      }
    } catch (err) {
      console.error('[webhook/retell]', err)
    }
  })

  return new Response('OK', { status: 200 })
}
```

### Idempotency

Retell may retry webhooks. To prevent duplicate processing:

```typescript
// handlers.ts
async function processCallEnded(callData: RetellCall) {
  const db = createServiceRoleClient()

  // Upsert to webhook_events table with unique constraint
  const { error: idempotencyError } = await db
    .from('webhook_events')
    .insert({
      source: 'retell',
      event_type: 'call_ended',
      external_id: callData.call_id, // Unique key
      payload: callData,
    })
    .select()
    .single()

  // If row already exists, upsert succeeds silently (no error)
  // If it's truly new, insert succeeds and we proceed
  if (idempotencyError && !idempotencyError.message.includes('duplicate')) {
    throw idempotencyError
  }

  // Now safe to process: create call row
  await db.from('calls').insert({
    contractor_id: callData.metadata.contractor_id,
    retell_call_id: callData.call_id,
    duration_seconds: callData.end_timestamp - callData.start_timestamp,
    analysis_status: 'analyzing',
  })
}
```

### Response Format

Always return HTTP 200 with JSON:

```typescript
after(async () => {
  // Downstream processing
})
return new Response('OK', { status: 200 })
```

Do NOT return:
- 202 Accepted (Retell expects 200)
- Partial responses (no need to return processed data to webhook sender)
- Errors that indicate retry is needed (always 200 — Retell will retry on server errors in `after()`)

## Inngest Background Jobs

### Function Definition

All Inngest functions are in `src/inngest/functions/`:

```typescript
// src/inngest/functions/retell-call-classify.ts
import 'server-only'
import { inngest } from '@/inngest/client'
import { NonRetriableError } from 'inngest'

export const retellCallClassify = inngest.createFunction(
  {
    id: 'retell-call-classify', // Unique function ID
    retries: 5, // Up to 5 automatic retries on failure
    triggers: [{ event: 'retell/call.classify' }], // Listen for this event
    onFailure: async ({ event }) => {
      // Called after all retries exhausted
      // Clean up: mark call as analysis_failed, etc.
      const { callId, contractorId } = event.data.event.data
      // ...
    },
  },
  async ({ event, step }) => {
    const { callId, contractorId, transcriptText } = event.data

    // Step 0: Load contractor settings
    const contractor = await step.run('load-contractor', async () => {
      const db = createServiceRoleClient()
      const { data, error } = await db
        .from('contractors')
        .select('*,contractor_settings(*)')
        .eq('id', contractorId)
        .single()
      if (error) throw new NonRetriableError('Contractor not found')
      return data
    })

    // Step 1: Check emergency keywords
    const isEmergency = await step.run('check-emergency', async () => {
      return hasHardEmergencyKeyword(transcriptText, contractor.language)
    })

    if (isEmergency) {
      await step.run('set-emergency', async () => {
        const db = createServiceRoleClient()
        await db.from('calls').update({ intent: 'emergency' }).eq('id', callId)
      })
      return // Skip LLM classification
    }

    // Step 2: Classify with OpenAI
    const { intent, confidence } = await step.run('classify-intent', async () => {
      return classifyIntent(transcriptText, contractor.language)
    })

    // Step 3: Fire downstream job
    await step.run('notify', async () => {
      await inngest.send({
        name: 'retell/call.notify',
        data: { callId, contractorId, intent },
      })
    })

    // Step 4: Update call status
    await step.run('update-call', async () => {
      const db = createServiceRoleClient()
      await db.from('calls').update({
        intent,
        analysis_status: 'complete',
      }).eq('id', callId)
    })
  }
)
```

### Triggering Jobs

Queue a job from any route or another Inngest function:

```typescript
// From a webhook handler (src/app/api/webhooks/retell/handlers.ts)
import { inngest } from '@/inngest/client'

export async function processCallAnalyzed(callData: RetellCall) {
  // ...
  await inngest.send({
    name: 'retell/call.classify',
    data: {
      callId: 'call-uuid',
      contractorId: 'contractor-uuid',
      transcriptText: callData.transcript,
      durationMs: callData.duration * 1000,
    },
  })
}
```

From a Server Action:
```typescript
// app/actions/settings.ts (Server Action)
'use server'

import { inngest } from '@/inngest/client'

export async function updateAgentSettings(contractorId: string, settings: unknown) {
  // ...save to DB
  // Then trigger agent sync job
  await inngest.send({
    name: 'retell/agent.sync',
    data: { contractorId },
  })
}
```

### Step Memoization

Each `step.run()` is memoized by Inngest. If a function retries:
- Steps that already completed skip re-execution
- Only new steps or failed steps run again

```typescript
// If this function fails after step 1, retrying skips to step 2
const contractor = await step.run('step-1-load', async () => { /* ... */ })
const intent = await step.run('step-2-classify', async () => { /* ... */ })
// ✓ Retry runs step-2 immediately, step-1 uses cached result
```

### Error Handling

Use `NonRetriableError` for errors that won't be fixed by retrying:

```typescript
if (!contractor) {
  throw new NonRetriableError('Contractor deleted after webhook sent')
  // Inngest immediately calls onFailure; stops retrying
}

// Regular errors trigger retry (up to 5 times)
if (openaiError) {
  throw new Error('OpenAI API error — will retry')
}
```

### Testing Inngest Functions

```typescript
// tests/inngest/retell-call-classify.test.ts
import { describe, it, expect, vi } from 'vitest'
import { retellCallClassify } from '@/inngest/functions/retell-call-classify'

describe('retellCallClassify', () => {
  it('should classify a lead intent correctly', async () => {
    const mockStep = {
      run: vi.fn(async (_name, fn) => fn()),
    }

    // Mock Inngest step context
    await retellCallClassify.handler({
      event: {
        data: {
          callId: 'test-call',
          contractorId: 'test-contractor',
          transcriptText: 'I need a plumber',
        },
      },
      step: mockStep,
    })

    // Assert step.run was called with correct names
    expect(mockStep.run).toHaveBeenCalledWith(
      expect.stringContaining('classify'),
      expect.any(Function)
    )
  })
})
```

## Database Migrations

### Creating a Migration

```bash
# Create migration file (Supabase CLI)
supabase migration new add_appointment_slots

# This creates: supabase/migrations/20260XXX000NNN_add_appointment_slots.sql
```

### Migration Template

```sql
-- supabase/migrations/20260515000008_add_appointment_slots.sql
-- Phase 4: Calendar integration — appointment slots table + RLS.
-- Source: RESEARCH.md — Calendar Slot Computation

-- =========================================================================
-- New table: appointment_slots
-- =========================================================================
CREATE TABLE appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  available BOOLEAN NOT NULL DEFAULT true,
  booked_at TIMESTAMPTZ,
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (call_id, slot_start)
);

-- RLS: Users can only see slots for their own contractor calls
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointment_slots: users can read/update own" ON appointment_slots
  FOR ALL USING (
    contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))
  );

-- Index for efficient lookups by call + time
CREATE INDEX idx_appointment_slots_call_id ON appointment_slots(call_id);
CREATE INDEX idx_appointment_slots_contractor_id_available
  ON appointment_slots(contractor_id, available, slot_start);

-- Comment for clarity
COMMENT ON TABLE appointment_slots IS 'Calendar appointment slots computed from Google Calendar API availability.';
```

### Migration Conventions

1. **Filename:** `YYYYMMDD000NNN_kebab-case-description.sql`
   - Date: when migration was created
   - NNN: sequence number (001, 002, etc.)
   - Must be chronologically unique

2. **RLS on every table:** Enable RLS and define all four operation policies in the same migration

3. **Indexes:** Add indexes on:
   - Foreign keys (contractor_id, call_id, etc.)
   - Columns used in WHERE clauses
   - Timestamp columns if used for ordering/filtering

4. **Constraints:** Use CHECK, UNIQUE, and FOREIGN KEY to ensure data integrity

5. **Comments:** Document intent, rationale, and source phase/decision

### Applying Migrations

```bash
# Local Supabase
supabase migration up

# Remote (linked to Vercel)
supabase migration up --linked

# Verify migration status
supabase migration list
```

### RLS Testing Before Deploy

```bash
# Create .env.test with unprivileged user JWT
npm run test

# All tests should pass with RLS enabled
# If tests fail, RLS is blocking legitimate queries
```

## Code Style & Linting

### TypeScript Type Checking

Strict mode enforced:

```bash
npm run typecheck
```

**Rules:**
- No `any` types without a comment explaining why
- No `as` casts without a comment
- All function parameters and returns must have types

```typescript
// Good
function processCall(call: Call): Promise<ClassifiedCall> {
  // ...
}

// Bad — missing types
function processCall(call: any) {
  // ...
}

// Acceptable with comment
function sendToExternal(data: unknown) {
  // External API returns untyped JSON; cast only after validation
  const parsed = externalSchema.parse(data) as ExternalResponse
  return parsed
}
```

### Linting (ESLint + Next.js)

```bash
# Check for linting errors
npm run lint

# Automatically fix fixable errors
npm run lint -- --fix
```

ESLint config: `Next.js built-in` (extends `eslint-config-next`)

Common fixes:
- Unused variables: remove
- Missing `key` in list renders: add key prop
- Unoptimized images: use Next.js `<Image>` component

### Code Formatting (Prettier)

No separate Prettier config; use formatter in your editor (VS Code recommended).

On save, format with:
- 2-space indentation
- Single quotes for strings
- Trailing commas
- Max line length: 100 (not enforced, but preferred)

## Git Workflow & Commit Conventions

### Branch Naming

Follow Conventional Commits style:

```
<type>/<scope>-<description>
```

- `feat/` — new feature (e.g., `feat/emergency-dispatch`)
- `fix/` — bug fix (e.g., `fix/rls-policy-leak`)
- `refactor/` — code refactoring (e.g., `refactor/extraction-service`)
- `test/` — tests only (e.g., `test/webhook-coverage`)
- `docs/` — documentation (e.g., `docs/api-guide`)
- `chore/` — dependencies, tooling (e.g., `chore/upgrade-next`)

Examples:
```
feat/google-calendar-integration
fix/timezone-conversion-bug
refactor/extract-classification-service
test/add-inngest-job-tests
```

### Commit Message Format

**Format:**
```
<type>(<scope>): <subject>

<body (optional)>

<footer (optional)>
```

**Rules:**
- Type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`, `style`, `revert`
- Scope: optional but recommended (e.g., `retell`, `calendar`, `notifications`, `rls`)
- Subject: imperative, lowercase, no period, ≤50 characters
- Body (optional): explain why, wrap at 72 characters
- Footer (optional): reference issues with `Closes: #123` or `Refs: #456`

**Examples:**

```
feat(calendar): add Google Calendar appointment booking

Implements automatic booking of qualified leads to contractor's Google Calendar.
Pulls available slots from calendar API, stores appointment records, and syncs
events back for confirmation.

Closes: #42
```

```
fix(webhook): prevent duplicate call processing on Retell retry

Use idempotency key (source + event_type + external_id) in webhook_events table
to ensure Retell webhook retries don't create duplicate calls or lead records.

Refs: #85
```

```
test(inngest): add coverage for retell-call-classify function

Add unit tests for emergency keyword detection, intent classification with mocked
OpenAI, and trade data extraction. Coverage rises from 65% to 82%.
```

```
docs: update DEVELOPMENT.md with Inngest patterns

Add examples of function definition, step memoization, and error handling.
Include testing patterns for durable jobs.
```

### Commit Checklist

Before pushing:

```bash
# 1. Run tests (all must pass)
npm run test

# 2. Type check (no errors)
npm run typecheck

# 3. Lint (no errors or fixable warnings)
npm run lint -- --fix

# 4. Review changes
git diff

# 5. Stage files
git add src/lib/classification/extract-trade.ts tests/lib/classification/extract-trade.test.ts

# 6. Commit with proper message
git commit -m "feat(classification): add trade data extraction from transcripts

Implements GPT-4o extraction of service type, issue description, and customer
contact info from call transcripts. Extracted data stored in leads table for
lead follow-up workflows.

Closes: #51"

# 7. Push
git push origin feat/trade-extraction
```

### Pull Request Workflow

1. **Create branch:** `git checkout -b feat/my-feature`
2. **Make changes:** edit files, commit with conventional messages
3. **Push:** `git push -u origin feat/my-feature`
4. **Create PR:** GitHub prompt appears; fill title + description
5. **PR description template:**
   ```markdown
   ## Summary
   Brief description of what this PR does (1-3 bullet points)

   ## Test Plan
   - [ ] Unit tests pass: `npm run test`
   - [ ] Type checking passes: `npm run typecheck`
   - [ ] Linting passes: `npm run lint`
   - [ ] RLS tested (if schema changes): `npm run test:db`
   - [ ] Manual testing: describe steps

   ## Notes
   Any additional context (breaking changes, migrations needed, etc.)
   ```

6. **Wait for review:** CI checks must pass (tests, lint, type check)
7. **Merge:** Squash and merge (one commit per feature)

## Common Gotchas & Debugging

### Webhook Signature Failures

**Error:** `Unauthorized` (401) from Retell webhook handler

**Causes:**
1. `RETELL_WEBHOOK_KEY` not set in `.env.local` or Vercel
2. Key is the REST API key, not the webhook key
3. Webhook signature algorithm mismatch (check if using POST timestamp in correct order)

**Fix:**
- Retell Dashboard → Settings → API Keys
- Copy the key marked with "webhook" badge (not the REST API key)
- Set `RETELL_WEBHOOK_KEY=<webhook-key>` in `.env.local`
- Restart dev server: `npm run dev`

### RLS Blocking Legitimate Queries

**Error:** Authenticated user gets empty result or 403 from SELECT query

**Causes:**
1. RLS policy uses wrong column (e.g., checking wrong contractor_id)
2. User is authenticated but policy references non-existent row in lookup table
3. Service-role client used in browser context (security breach)

**Debug:**
```bash
# Run tests with real .env.test JWT (forces RLS)
npm run test

# If tests fail on selects that should work, RLS is wrong
# Check policy: SELECT * FROM information_schema.row_security_policies
#   WHERE table_name = 'calls'
```

**Fix:**
- Update migration to correct policy
- Re-apply: `supabase migration up --force`
- Test with unprivileged user in test suite

### Google OAuth Token Decryption Error

**Error:** `Failed to decrypt token` in classification job

**Causes:**
1. `OAUTH_ENCRYPTION_KEY` changed between encryption and decryption
2. Token was encrypted with old key, decryption tried with new key
3. Encryption key not set at all (defaults to all zeros)

**Fix:**
- Keep encryption key stable across deploys
- Generate new key only if re-keying all tokens (data loss otherwise)
- Command: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Inngest Function Not Running

**Error:** Job queued but never executes

**Causes:**
1. Function not registered (missing from `src/inngest/functions/` import)
2. Event name doesn't match trigger name (typo in `inngest.send()`)
3. Inngest API key not set in Vercel environment

**Debug:**
```bash
# Check Inngest dashboard for recent invocations
# Look at Function Logs tab

# Or query locally
curl https://api.inngest.com/v1/events \
  -H "Authorization: Bearer $INNGEST_EVENT_KEY" | jq '.[]' | head -5
```

**Fix:**
- Register function in `src/inngest/functions/index.ts` (if using index)
- Verify event name matches exactly (case-sensitive)
- Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel

### TypeScript "Not assignable to type 'any'" Error

**Error:** `Type 'unknown' is not assignable to type 'any'`

**Causes:**
- Parsing JSON response without validation
- Function returns `unknown` but you're treating it as typed

**Fix:**
```typescript
// Bad
const data = JSON.parse(response) // data is 'any', causes error
const result: MyType = data

// Good
const data = JSON.parse(response) as unknown
const result = mySchema.parse(data) // Zod validates, returns typed result
```

### "Service role key in browser" Warning

**Error:** Console warning about exposing service-role key

**Causes:**
- Imported `createServiceRoleClient()` in a Client Component
- Service role key leaked via browser network request

**Fix:**
- Move call to `createServiceRoleClient()` into Server Component or API route
- If needed from Client Component, call Server Action instead:

```typescript
// Bad: Client Component
'use client'
import { createServiceRoleClient } from '@/lib/supabase/service'

export function MyComponent() {
  const db = createServiceRoleClient() // ❌ Leaks key to browser
}

// Good: use Server Action
// lib/actions/fetch-data.ts
'use server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function fetchProtectedData() {
  const db = createServiceRoleClient() // ✓ Server-side only
  return db.from('table').select()
}

// Call from Client Component
'use client'
import { fetchProtectedData } from '@/lib/actions/fetch-data'

export function MyComponent() {
  const data = await fetchProtectedData() // ✓ Server Action
}
```

### Port 3000 Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Fix:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use a different port
npm run dev -- --port 3001
```

### Out-of-Memory During Build

**Error:** `JavaScript heap out of memory`

**Causes:**
- Webpack processing too many files
- TypeScript checking too many modules
- Old node_modules cache

**Fix:**
```bash
# Clear cache
rm -rf .next node_modules/.cache

# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or in package.json:
# "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
```

## Summary

Development follows a strict TDD discipline: write tests first, implement to make tests pass, refactor for clarity. Use Server Components for data loading and Server Actions for mutations, keeping Client Components focused on interactivity. Always verify webhook signatures, return 200 immediately from webhook handlers, and defer processing to `after()` context. RLS is enforced on all tables; test migrations with unprivileged users before deploy. Commit messages follow Conventional Commits format. Type safety is strict (no `any` without comment). All API keys are environment variables; never commit secrets.

