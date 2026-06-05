<!-- generated-by: gsd-doc-writer -->
# Testing

Koolable uses **Vitest** for unit and integration tests, **Playwright** for end-to-end tests, and strict TDD discipline: tests drive implementation, domain logic has unit test coverage, and all webhook handlers and API routes have integration tests with mocked boundaries.

## Testing Philosophy

**Three-level test pyramid:**

1. **Unit tests** (`tests/lib/*.test.ts`) — Domain logic in isolation
   - Intent classification (OpenAI mocked)
   - Calendar slot matching and booking conflict detection
   - Token encryption/decryption (crypto)
   - Lead classification and trade-specific data extraction
   - No database, no external API calls

2. **Integration tests** (`tests/api/*.test.ts`, `tests/db/*.test.ts`) — Boundaries and contracts
   - API routes with Supabase client mocked
   - Webhook handlers (Retell, Stripe, Telegram) with request/response mocks
   - Database RLS (Row-Level Security) isolation with real Supabase test user JWTs
   - Inngest task functions with notification channel dispatch mocked

3. **End-to-end tests** (`tests/*.spec.ts`) — Full UI workflows with Playwright
   - Authentication flows (email signup, login)
   - Contractor dashboard (call logs, leads, agent settings)
   - Subscription and payment flows
   - Manual testing gates (e.g., test calls to Retell agents)

## Test Structure

**Directory organization:**

```
tests/
  __mocks__/           # Shared mock implementations (OpenAI, Supabase, server-only shim)
  setup.ts             # Global test setup (load .env.test, set crypto key)
  lib/                 # Unit tests for src/lib/ domain logic
    classification.test.ts
    oauth.test.ts
    booking.test.ts
    scheduling.test.ts
    ...
  api/                 # Integration tests for src/app/api/ routes
    webhook.test.ts    # Retell webhook handler
    stripe-checkout.test.ts
    notification-settings.test.ts
    provisioning.test.ts
    ...
  db/                  # Database-level integration tests
    rls.test.ts        # RLS isolation (requires test fixtures)
    contractor_settings.test.ts
    webhook_events.test.ts
    provisioning.test.ts
  inngest/             # Inngest task function tests
    computeChannels-email.test.ts
    stripe-payment-failure-email.test.ts
  actions/             # Server action tests
    telegram-webhook.test.ts
  notifications/       # Notification dispatch tests
    sms.test.ts
    whatsapp.test.ts
    telegram.test.ts
    email.test.ts
    ...
  ui/                  # Component tests
    phone-settings.test.tsx
  accessibility/       # Accessibility audits
    logo-audit.test.ts
  *.spec.ts            # E2E tests (Playwright)
    auth.spec.ts
    phase-*.spec.ts
    regression-v1-smoke.spec.ts
```

**File naming:**
- Unit/integration: `*.test.ts` or `*.test.tsx`
- E2E: `*.spec.ts`
- `.test.ts` files run under Vitest; `.spec.ts` files run under Playwright (excluded from Vitest)

## Unit Test Examples

### Intent Classification (Mocked LLM)

```typescript
// tests/lib/classification.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockParse } = vi.hoisted(() => ({
  mockParse: vi.fn(),
}))

vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { parse: mockParse } }
    constructor(_opts?: unknown) {}
  }
  return { default: OpenAI }
})

import { hasHardEmergencyKeyword } from '@/lib/classification/emergency-keywords'

describe('hasHardEmergencyKeyword (EMRG-02)', () => {
  it('returns true for "gas smell" in English', () => {
    expect(hasHardEmergencyKeyword('gas smell detected in the house')).toBe(true)
  })

  it('returns true for "olor a gas" in Spanish', () => {
    expect(hasHardEmergencyKeyword('olor a gas en la cocina')).toBe(true)
  })

  it('returns false for non-hard-coded keyword (goes to LLM)', () => {
    expect(hasHardEmergencyKeyword('no heat in the house')).toBe(false)
  })
})

describe('classifyIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns valid intent enum from LLM parse (lead | emergency | info | no_action)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { intent: 'lead', detected_trade: 'hvac', confidence: 'high' },
          },
        },
      ],
    })

    const { classifyIntent } = await import('@/lib/classification/classify-intent')
    const result = await classifyIntent('Customer called about gas smell', false)

    expect(result.intent).toBe('lead')
    expect(['lead', 'emergency', 'info', 'no_action']).toContain(result.intent)
  })
})
```

### Calendar Slot Matching (Booking Conflict Detection)

```typescript
// tests/lib/booking.test.ts
describe('appointment creation', () => {
  it('catches UNIQUE constraint 23505 and sets lead.booking_conflict=true', () => {
    const error = { code: '23505' }
    const isBookingConflict = error.code === '23505'
    expect(isBookingConflict).toBe(true)

    const leadStatus = isBookingConflict ? 'new' : 'booked'
    expect(leadStatus).toBe('new')
  })

  it('google_sync_status=skipped when no calendar connected', () => {
    const calendarClient = null
    const status = calendarClient ? 'pending' : 'skipped'
    expect(status).toBe('skipped')
  })
})
```

### Token Encryption (OAuth Credentials)

```typescript
// tests/lib/oauth.test.ts
vi.mock('@/lib/crypto/tokens', () => ({
  encryptToken: (token: string) => `encrypted:${token}`,
  decryptToken: (token: string) => token.replace('encrypted:', ''),
}))

describe('getCalendarClient token refresh', () => {
  it('calls refreshAccessToken when token_expiry within 5 minutes', async () => {
    const soonExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString()

    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 60 * 60 * 1000,
      },
    })

    const { getCalendarClient } = await import('@/lib/google/auth')
    const client = await getCalendarClient('contractor-123')

    expect(mockRefreshAccessToken).toHaveBeenCalled()
  })
})
```

## Integration Test Examples

### Webhook Handler (Retell Call Event)

```typescript
// tests/api/webhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({
  after: vi.fn((fn) => fn()),
}))

const mockMaybeSingleContractor = vi.fn()
const mockMaybeSingleCallRow = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'contractors') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingleContractor,
            })),
          })),
        }
      }
      return {
        upsert: mockUpsert,
      }
    }),
  })),
}))

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))

import { processCallEnded } from '@/app/api/webhooks/retell/handlers'

// Helper: generate valid HMAC signature for testing
function generateSignature(rawBody: string, webhookKey: string): string {
  const timestamp = Date.now()
  const mac = createHmac('sha256', webhookKey).update(rawBody + timestamp).digest('hex')
  return `v=${timestamp},d=${mac}`
}

describe('POST /api/webhooks/retell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RETELL_API_KEY = 'test-retell-key'
    process.env.RETELL_WEBHOOK_KEY = 'test-webhook-key'
    mockMaybeSingleContractor.mockResolvedValue({ data: null, error: null })
  })

  it('returns 200 immediately for valid call_ended event', async () => {
    const { POST } = await import('@/app/api/webhooks/retell/route')

    const callPayload = {
      call_id: 'call-123',
      agent_id: 'agent-abc',
      from_number: '+15555550100',
      to_number: '+15555550200',
      direction: 'inbound' as const,
      call_status: 'ended',
    }

    const rawBody = JSON.stringify({ event: 'call_ended', call: callPayload })
    const signature = generateSignature(rawBody, 'test-webhook-key')

    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-retell-signature': signature,
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 for forged signature', async () => {
    const { POST } = await import('@/app/api/webhooks/retell/route')

    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      body: JSON.stringify({ event: 'call_ended', call: {} }),
      headers: {
        'content-type': 'application/json',
        'x-retell-signature': 'v=999999,d=fakesignature',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('implements idempotency via upsert on webhook_events table', async () => {
    const { POST } = await import('@/app/api/webhooks/retell/route')
    // Webhook upserted on (source + event_type + external_id) unique constraint
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'retell',
        event_type: 'call_ended',
        external_id: 'call-123',
      })
    )
  })
})
```

### RLS Isolation (Row-Level Security)

```typescript
// tests/db/rls.test.ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const userAJwt = process.env.TEST_USER_A_JWT
const userBJwt = process.env.TEST_USER_B_JWT

const hasFixtures = url && anonKey && userAJwt && userBJwt

function authedClient(jwt: string) {
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

describe.skipIf(!hasFixtures)('RLS isolation across all 9 tables (D-18)', () => {
  let clientA: ReturnType<typeof createClient>
  let clientB: ReturnType<typeof createClient>

  beforeAll(() => {
    if (hasFixtures) {
      clientA = authedClient(userAJwt!)
      clientB = authedClient(userBJwt!)
    }
  })

  describe('contractors table', () => {
    it('User A SELECT cannot return User B contractor row', async () => {
      const { data } = await clientA.from('contractors').select('id').eq('id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })

    it('User A UPDATE cannot modify User B contractor row', async () => {
      const { data } = await clientA
        .from('contractors')
        .update({ business_name: 'HACKED' })
        .eq('id', contractorBId)
        .select()

      expect((data ?? []).length).toBe(0)

      // Verify row unchanged via service role
      const serviceClient = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: check } = await serviceClient
        .from('contractors')
        .select('business_name')
        .eq('id', contractorBId)
        .single()

      expect(check?.business_name).not.toBe('HACKED')
    })

    it('User A DELETE cannot remove User B contractor row', async () => {
      const { data } = await clientA.from('contractors').delete().eq('id', contractorBId).select()
      expect((data ?? []).length).toBe(0)
    })
  })
})
```

### Inngest Task (Notification Channel Dispatch)

```typescript
// tests/inngest/computeChannels-email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/notifications/sms', () => ({ sendSms: vi.fn() }))
vi.mock('@/lib/notifications/whatsapp', () => ({ sendWhatsApp: vi.fn() }))
vi.mock('@/lib/notifications/telegram', () => ({ sendTelegram: vi.fn() }))

import { computeChannels } from '@/inngest/functions/retell-notify-dispatch'
import type { NotificationSettings, CallIntent } from '@/types/database'

function makeEmailSettings(overrides = {}) {
  return {
    sms_number: null,
    whatsapp_number: null,
    telegram_chat_id: null,
    notify_on_lead: true,
    notify_on_emergency: true,
    notify_sms_enabled: true,
    notify_whatsapp_enabled: false,
    notify_telegram_enabled: false,
    notify_email_enabled: false,
    email_address: null,
    ...overrides,
  }
}

describe('computeChannels — email channel gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shouldSendEmail=true when email_address set, notify_email_enabled=true, intent=lead', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_lead: true,
    })

    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendEmail).toBe(true)
  })

  it('shouldSendEmail=false when email_address missing', () => {
    const settings = makeEmailSettings({
      notify_email_enabled: true,
      email_address: null,
    })

    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendEmail).toBe(false)
  })
})
```

## Running Tests

### Unit & Integration Tests (Vitest)

**Full suite:**
```bash
npm test
```
Output: `PASS tests/lib/classification.test.ts`, summary of passed/failed, coverage report.

**Watch mode (for development):**
```bash
npm run test:watch
```
Reruns tests on file change.

**Filter by pattern:**
```bash
npm test -- classification
npm test -- webhook
npm test -- rls
npm test -- oauth
```

**Run single file:**
```bash
npm test -- tests/api/webhook.test.ts
```

**Run with coverage:**
```bash
npm test -- --coverage
```
Outputs HTML report to `coverage/index.html`.

### End-to-End Tests (Playwright)

**Full suite:**
```bash
npm run test:e2e
```

**Watch mode:**
```bash
npx playwright test --watch
```

**Run single test file:**
```bash
npx playwright test tests/auth.spec.ts
```

**Debug mode (opens Inspector UI):**
```bash
npx playwright test --debug
```

**Update snapshots:**
```bash
npx playwright test --update-snapshots
```

## Mocking Patterns

### Database (Supabase)

**Mock the service-role client for API routes:**

```typescript
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: mockFrom,
  }),
}))

// In test:
mockFrom.mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'contractor-123' },
        error: null,
      }),
    }),
  }),
})
```

### HTTP Requests (OpenAI, Stripe, Retell)

**OpenAI (LLM classification):**
```typescript
const { mockParse } = vi.hoisted(() => ({
  mockParse: vi.fn(),
}))

vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { parse: mockParse } }
  }
  return { default: OpenAI }
})

// In test:
mockParse.mockResolvedValueOnce({
  choices: [
    {
      message: {
        parsed: { intent: 'lead', detected_trade: 'hvac', confidence: 'high' },
      },
    },
  ],
})
```

**Stripe Webhook Signature Verification:**
```typescript
import { createHmac } from 'crypto'

function generateStripeSignature(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signed_content = `${timestamp}.${rawBody}`
  const signature = createHmac('sha256', secret).update(signed_content).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

const req = new Request('http://localhost/api/webhooks/stripe', {
  method: 'POST',
  body: JSON.stringify(stripeEvent),
  headers: {
    'stripe-signature': generateStripeSignature(JSON.stringify(stripeEvent), 'whsec_test'),
  },
})
```

### Inngest Tasks

**Mock the Inngest client:**
```typescript
vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, handler: unknown) => ({
      _handler: handler,
    })),
    send: vi.fn(),
  },
}))
```

## Test Helpers & Fixtures

### Environment Variables

**`.env.test`** — Loaded automatically by `tests/setup.ts`:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TEST_USER_A_JWT=...
TEST_USER_B_JWT=...
TEST_CONTRACTOR_A_ID=...
TEST_CONTRACTOR_B_ID=...
OAUTH_ENCRYPTION_KEY=...
```

### Test Data Builders

**Minimal Retell call payload:**
```typescript
function makeCall(overrides = {}) {
  return {
    call_id: 'call-123',
    agent_id: 'agent-abc',
    from_number: '+15555550100',
    to_number: '+15555550200',
    direction: 'inbound' as const,
    call_status: 'ended',
    ...overrides,
  }
}
```

**Minimal contractor record:**
```typescript
const mockContractor = {
  id: 'ce9c3e82-a90a-49b2-ba33-97a4f4a81f81',
  user_id: '93b11960-b990-4955-a418-567b8b93319b6',
  business_name: 'ABC HVAC',
  subscription_status: 'active',
  stripe_subscription_id: 'sub_123',
}
```

**Notification settings with email channel:**
```typescript
const emailSettings = {
  contractor_id: 'contractor-123',
  sms_number: '+15551234567',
  whatsapp_number: '+15551234567',
  telegram_chat_id: 'telegram-123',
  notify_on_lead: true,
  notify_on_emergency: true,
  notify_sms_enabled: true,
  notify_whatsapp_enabled: true,
  notify_telegram_enabled: false,
  notify_email_enabled: true,
  email_address: 'contractor@example.com',
}
```

### Mock Request Objects

**Next.js API route POST request:**
```typescript
function makeRequest(body: object, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}
```

## CI/CD Testing

**No GitHub Actions workflow exists yet.** Manual testing gates:

1. **Before merging to `main`:**
   - Run `npm test` locally — all unit and integration tests pass
   - Run `npm run test:e2e` locally for critical paths (auth, webhook, subscription)
   - Lint and typecheck: `npm run lint` and `npm run typecheck`

2. **Before production deploy (Vercel):**
   - Retell test call to verify call classification pipeline (manual)
   - Lead creation + Google Calendar sync for a test contractor (manual)
   - SMS/WhatsApp/Telegram notification dispatch (manual)

3. **Post-deploy monitoring:**
   - Watch Retell call logs for classification errors
   - Check Supabase logs for RLS violations or 401s
   - Monitor Inngest task logs for failed notification sends

## Manual Testing Workflows

### Testing Webhook Integrations with ngrok

**1. Expose local dev server:**
```bash
npx ngrok http 3000
```
This generates a public URL like `https://abc123.ngrok.io`.

**2. Update webhook URLs in testing environment:**
- Retell agent webhook URL: `https://abc123.ngrok.io/api/webhooks/retell`
- Stripe dashboard: Endpoints → Add endpoint → `https://abc123.ngrok.io/api/webhooks/stripe`

**3. Monitor webhook traffic:**
```bash
npx ngrok config add-authtoken <your-token>
npx ngrok http 3000  # Watch request/response in real time
```

### Retell Call Simulation

**1. Trigger a test call via Retell dashboard:**
- Go to Retell dashboard → Agents
- Find your test agent (e.g., "HVAC Agent - Test")
- Click "Test Call" button
- Speak your test scenario (e.g., "My air conditioner is not cooling")

**2. Verify webhook received:**
```bash
# Check logs in terminal running `npm run dev`
# Should see POST /api/webhooks/retell with event: call_ended
```

**3. Check call classification:**
- Query Supabase: `SELECT * FROM calls WHERE call_id = 'call-xxx'`
- Verify `intent`, `detected_trade`, and `urgency` fields populated correctly

### Calendar Integration Testing

**1. Create test contractor with Google Calendar connected:**
```bash
# Run locally with auth flow
npm run dev
# Login as test contractor
# Connect Google Calendar via OAuth
```

**2. Trigger test call with appointment confirmation:**
- Use Retell test call feature
- Confirm an appointment time in the call (e.g., "Tuesday at 10 AM")
- Verify calendar event created in Google Calendar

**3. Check sync status:**
```sql
SELECT confirmed_appointment_time, google_sync_status, booking_conflict
FROM leads
WHERE call_id = 'call-xxx'
```

## Coverage Targets & Enforcement

**Current state:** No coverage thresholds configured in `vitest.config.ts`.

**Recommended minimums (for Phase 7+):**
- **Lines:** 70%
- **Functions:** 70%
- **Branches:** 60%
- **Statements:** 70%

**Enable in `vitest.config.ts`:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
  },
})
```

**View coverage report:**
```bash
npm test -- --coverage
open coverage/index.html
```

## Common Test Failures & Debugging

### "Cannot find module 'server-only'"

**Cause:** `server-only` is shimmed for testing because the real package throws in non-Next.js environments (Vitest jsdom).

**Fix:** Ensure `vitest.config.ts` has the shim alias:
```typescript
resolve: {
  alias: {
    'server-only': path.resolve(__dirname, './tests/__mocks__/server-only.ts'),
  },
}
```

### "Mock is not a constructor"

**Cause:** `vi.hoisted()` variables used inside a `vi.mock()` factory, but the factory doesn't return them properly.

**Fix:** Use `vi.hoisted()` to hoist variables outside the factory:
```typescript
const { mockParse } = vi.hoisted(() => ({
  mockParse: vi.fn(),
}))

vi.mock('openai', () => {
  return { default: class OpenAI { chat = { completions: { parse: mockParse } } } }
})
```

### "RLS test skipped"

**Cause:** One or more test environment variables missing (`.env.test` not loaded).

**Fix:** Verify `.env.test` exists and contains:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TEST_USER_A_JWT`
- `TEST_USER_B_JWT`
- `TEST_CONTRACTOR_A_ID`
- `TEST_CONTRACTOR_B_ID`

Run `npm test -- rls` to see which vars are missing.

### "Supabase service role key not found"

**Cause:** RLS test tried to verify a row was not modified by unauthorized user, but couldn't read via service role.

**Fix:** Ensure `SUPABASE_SERVICE_ROLE_KEY` in `.env.test`. Note: RLS tests require a live Supabase project (cannot run offline).

### "Test timeout after 5000ms"

**Cause:** Async operation (API call, database query) didn't complete.

**Fix:** Increase timeout for that test:
```typescript
it('long-running integration test', async () => {
  // test body
}, { timeout: 15000 })
```

### "Mock not called with expected arguments"

**Cause:** Mock assertion failure — use `toHaveBeenCalledWith()` to debug.

**Fix:** Print actual calls:
```typescript
expect(mockFn).toHaveBeenCalledWith('expected-arg')
// If fails, add:
console.log('Actual calls:', mockFn.mock.calls)
```

### "Response body is already read"

**Cause:** Called `res.json()` twice on the same Response object.

**Fix:** Store the parsed body once:
```typescript
const res = await POST(req)
const body = await res.json()
expect(body.error).toMatch(/.../)
expect(res.status).toBe(400)
```

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and component boundaries
- [DEVELOPMENT.md](./DEVELOPMENT.md) — Setup and local development
- [CONFIGURATION.md](./CONFIGURATION.md) — Environment variables and config
- `.env.test` — Test-specific secrets and fixtures (not checked in)
