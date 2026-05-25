# Phase 2: Provisioning - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 13 (8 new, 5 edits)
**Analogs found:** 11 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/provisioning/create/route.ts` | API route | request-response | `src/app/api/onboarding/create-account/route.ts` | exact |
| `src/app/api/provisioning/update-agent/route.ts` | API route | request-response | `src/app/api/onboarding/create-account/route.ts` | role-match |
| `src/inngest/client.ts` | utility/config | event-driven | `src/lib/supabase/service.ts` (singleton init pattern) | partial |
| `src/inngest/functions/retell-agent-sync.ts` | service | event-driven | `src/lib/crypto/tokens.ts` (server-only module pattern) | partial |
| `src/app/api/inngest/route.ts` | API route | event-driven | `src/app/(auth)/auth/callback/route.ts` | role-match |
| `src/lib/retell/client.ts` | utility | request-response | `src/lib/supabase/service.ts` | exact |
| `src/lib/retell/system-prompt.ts` | utility | transform | `src/lib/crypto/tokens.ts` | role-match |
| `supabase/migrations/20260506000004_agent_sync_status.sql` | migration | CRUD | `supabase/migrations/20260504000001_initial_schema.sql` | exact |
| `src/types/database.ts` (edit) | model | — | self | — |
| `src/app/actions/settings.ts` (edit) | service | request-response | self | — |
| `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` (edit) | component | request-response | self | — |
| `src/lib/validations/onboarding.ts` (edit) | utility | transform | self | — |
| `.env.example` (edit) | config | — | self | — |

---

## Pattern Assignments

### `src/app/api/provisioning/create/route.ts` (API route, request-response)

**Analog:** `src/app/api/onboarding/create-account/route.ts`

**Imports pattern** (lines 1–7):
```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { phoneSchema } from '@/lib/validations/onboarding'
```

**Auth pattern** (lines 10–15):
```typescript
// 1. Verify caller is authenticated (anon client + getUser, NOT getSession)
const supabase = await createSupabaseServer()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Validation pattern** (lines 17–21):
```typescript
// 2. Validate request body with zod
const body = phoneSchema.safeParse(await req.json())
if (!body.success) {
  return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
}
```

**Service role client + idempotency pattern** (lines 23–48):
```typescript
// 3. Use service role for write operations (bypasses RLS)
const serviceClient = createServiceRoleClient()

// 4. Check if contractor already exists (idempotency)
const { data: existing } = await serviceClient
  .from('contractors')
  .select('id, phone_number')
  .eq('user_id', user.id)
  .maybeSingle()
```

**Error handling pattern** (lines 43–50):
```typescript
if (cErr || !contractor) {
  console.error('[create-account] contractor insert failed:', cErr?.message)
  return NextResponse.json({ error: 'Failed to create contractor.' }, { status: 500 })
}
```

**Success response pattern** (line 106):
```typescript
return NextResponse.json({ contractor_id })
```

**Ownership pattern (critical for provisioning):** The `create-account` route always looks up the contractor by `user_id` from the JWT — never from the request body. The provisioning route must follow the same pattern: load contractor via `.eq('user_id', user.id)`, never accept `contractor_id` from the request body (STRIDE: elevation of privilege).

---

### `src/app/api/provisioning/update-agent/route.ts` (API route, request-response)

**Analog:** `src/app/api/onboarding/create-account/route.ts`

Same auth + service role pattern as `create/route.ts`. Key differences for `update-agent`:
- Use `PATCH` HTTP method export (`export async function PATCH`)
- DB write happens BEFORE the Retell API call (D-11: DB is source of truth)
- If Retell call fails, queue Inngest event and return `200 { ok: true }` — do not surface Retell errors to the caller
- Set `agent_sync_status = 'pending'` before the Retell call; Inngest sets it to `'synced'` on success or `'failed'` on exhaustion

**Imports pattern** (same base as create route, plus Inngest):
```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import { inngest } from '@/inngest/client'
```

**DB-first + background retry pattern** (from RESEARCH.md D-11 and D-12):
```typescript
// 1. Always persist to Supabase FIRST (DB is source of truth — D-11)
await serviceClient.from('contractor_settings').update({ ...newSettings }).eq('contractor_id', contractor.id)
await serviceClient.from('contractors').update({ agent_sync_status: 'pending' }).eq('id', contractor.id)

// 2. Attempt Retell sync; on failure queue Inngest retry
try {
  const retell = getRetellClient()
  await retell.llm.update(contractor.retell_llm_id, {
    general_prompt: buildSystemPrompt(settings),
    begin_message: buildBeginMessage(settings),
  })
  await serviceClient.from('contractors').update({ agent_sync_status: 'synced' }).eq('id', contractor.id)
} catch (err) {
  console.error('[update-agent] Retell sync failed, queuing retry:', err)
  await inngest.send({
    name: 'retell/agent.sync',
    data: { contractorId: contractor.id, llmId: contractor.retell_llm_id, compiledPrompt, beginMessage },
  })
}

return NextResponse.json({ ok: true })
```

---

### `src/lib/retell/client.ts` (utility, request-response)

**Analog:** `src/lib/supabase/service.ts`

The service client uses the identical singleton pattern: `import 'server-only'`, validate env var at call time, return a module-level cached instance.

**Full pattern** (`src/lib/supabase/service.ts`, lines 1–23):
```typescript
// CRITICAL: This file is server-only. SUPABASE_SERVICE_ROLE_KEY must NEVER have NEXT_PUBLIC_ prefix.
// Service role bypasses RLS — use only in API routes for operations the user's anon client cannot perform.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'createServiceRoleClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
      'The service role key MUST NOT be prefixed with NEXT_PUBLIC_ (would expose to browser).'
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

**Apply to `src/lib/retell/client.ts`:** Replace `createClient(url, serviceRoleKey, ...)` with `new Retell({ apiKey })`. Same guard structure. Use a module-level `let _client: Retell | null = null` for the singleton. Export `getRetellClient()` (not `createRetellClient()`) to match the lazy-init naming used in RESEARCH.md.

---

### `src/lib/retell/system-prompt.ts` (utility, transform)

**Analog:** `src/lib/crypto/tokens.ts`

Pure server-side utility — no I/O, no side effects, exported functions only. The crypto module shows the project convention for server-utility modules: no class, pure exported functions, `import 'server-only'` not needed here (no secrets), typed parameters.

**Module structure pattern** (`src/lib/crypto/tokens.ts`, lines 1–7):
```typescript
// src/lib/crypto/tokens.ts
// Source comment referencing the research/decision that mandates this module.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Module-level constants
const ALGORITHM = 'aes-256-gcm'
```

**Apply to `src/lib/retell/system-prompt.ts`:** Two exported functions: `buildSystemPrompt(settings: ContractorSettings): string` and `buildBeginMessage(settings: ContractorSettings): string`. Import `ContractorSettings` from `@/types/database`. No `import 'server-only'` needed — the function itself contains no secrets. The calling route (`client.ts`) is already server-only.

---

### `src/inngest/client.ts` (config, event-driven)

**Analog:** `src/lib/supabase/service.ts` (module-level export pattern)

The project's convention for infrastructure singletons is a named export from a dedicated lib file. `service.ts` exports `createServiceRoleClient`. The Inngest client follows the same file-per-singleton pattern but exports the instance directly (not a factory), as Inngest's `createFunction` API requires a reference to the Inngest instance at module load time.

**Pattern to copy:**
```typescript
// Module header comment citing source decision
import 'server-only'
// Named export of the singleton instance
export const supabase = ...  // → adapt to: export const inngest = new Inngest({ id: 'voicedesk' })
```

No lazy-init needed — `Inngest` constructor is cheap and does not open a connection.

---

### `src/inngest/functions/retell-agent-sync.ts` (service, event-driven)

**Analog:** `src/lib/crypto/tokens.ts` (server-side module with `import 'server-only'`, pure logic)

No direct Inngest analog exists in the codebase. Use RESEARCH.md Pattern 4 as the primary reference. The module conventions to follow from the codebase are:
- `import 'server-only'` at top (this file calls Retell and Supabase with service-role credentials)
- Named export of the function object (`export const retellAgentSync = ...`)
- Console error logging on failures: `console.error('[retell-agent-sync] step failed:', err)`
- Use `createServiceRoleClient()` from `@/lib/supabase/service` (same pattern as route handlers)

**Logging pattern** from `src/app/api/onboarding/create-account/route.ts` (lines 46, 63):
```typescript
console.error('[create-account] contractor update failed:', uErr.message)
console.error('[create-account] ROLLBACK FAILED — orphaned contractor row:', contractor_id, rbErr.message)
```

Apply the same `[function-name]` prefix on all `console.error` calls inside the Inngest function steps.

---

### `src/app/api/inngest/route.ts` (API route, event-driven)

**Analog:** `src/app/(auth)/auth/callback/route.ts`

The auth callback is the simplest existing route — a thin adapter that delegates to a library. The Inngest serve route follows the same pattern: import the library adapter, export named HTTP method handlers. No auth check, no service client, no zod validation.

**Route export pattern** (`src/app/(auth)/auth/callback/route.ts`):
```typescript
import { NextResponse } from 'next/server'
// ...
export async function GET(request: NextRequest) { ... }
```

**Apply to Inngest route:** Export `GET`, `POST`, and `PUT` from the `serve()` call. This is the only route in the project that exports three HTTP method handlers simultaneously.

---

### `supabase/migrations/20260506000004_agent_sync_status.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260504000001_initial_schema.sql` and `supabase/migrations/20260504000003_contractor_defaults.sql`

**File header pattern** (`20260504000003_contractor_defaults.sql`, lines 1–3):
```sql
-- 20260504000003_contractor_defaults.sql
-- Verifies and documents the D-11 emergency keyword defaults and LANG-02 constraint.
-- This migration intentionally re-affirms the DEFAULT values; it is safe to re-run.
```

**ALTER TABLE pattern** (`20260504000003_contractor_defaults.sql`, lines 9–15):
```sql
ALTER TABLE contractor_settings
  ALTER COLUMN emergency_keywords
  SET DEFAULT '{ ... }'::JSONB;
```

**CHECK constraint pattern** (`20260504000001_initial_schema.sql`, lines 65–69):
```sql
CONSTRAINT contractor_settings_supported_languages_valid
  CHECK (
    supported_languages <@ ARRAY['en','es','ht']::TEXT[]
    AND array_length(supported_languages, 1) >= 1
  )
```

**COMMENT ON CONSTRAINT pattern** (`20260504000003_contractor_defaults.sql`, lines 21–23):
```sql
COMMENT ON CONSTRAINT contractor_settings_supported_languages_valid
  ON contractor_settings
  IS 'LANG-02: supported_languages must be a non-empty subset of {en, es, ht}';
```

**DROP + ADD constraint pattern** (to replace existing constraint):
```sql
ALTER TABLE contractor_settings
  DROP CONSTRAINT contractor_settings_supported_languages_valid;
ALTER TABLE contractor_settings
  ADD CONSTRAINT contractor_settings_supported_languages_valid
    CHECK ( ... );
```

---

### `src/types/database.ts` (edit — remove 'ht')

**File:** `src/types/database.ts`

**Current state, lines to change:**

Line 5 — `Language` union type:
```typescript
// BEFORE
export type Language = 'en' | 'es' | 'ht'
// AFTER
export type Language = 'en' | 'es'
```

Lines 51–55 — `EmergencyKeywords` interface:
```typescript
// BEFORE
export interface EmergencyKeywords {
  en: string[]
  es: string[]
  ht: string[]
}
// AFTER
export interface EmergencyKeywords {
  en: string[]
  es: string[]
}
```

`Contractor` interface also needs two new fields added (lines 17–33) for the new migration columns:
```typescript
// ADD after retell_agent_id line:
retell_llm_id: string | null
agent_sync_status: 'synced' | 'failed' | 'pending' | null
```

---

### `src/app/actions/settings.ts` (edit — remove 'ht' reference)

**File:** `src/app/actions/settings.ts`

Line 16 comment references `'ht'`:
```typescript
// BEFORE (line 16)
// 2. Validate input against Plan 03 zod schema (LANG-02 floor: ['en'|'es'|'ht'][], min 1)
// AFTER
// 2. Validate input against zod schema (supported: ['en'|'es'], min 1; D-01 Phase 2 removes 'ht')
```

No logic change — the comment is the only 'ht' reference. The `languageSchema` import on line 6 will automatically pick up the narrowed enum after `onboarding.ts` is edited.

---

### `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` (edit — remove HC checkbox)

**File:** `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx`

Lines 11–15 — `ALL_LANGUAGES` array:
```typescript
// BEFORE
const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'ht', label: 'Haitian Creole' },
]
// AFTER
const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
]
```

No other changes needed — the `toggle()` function, `min(1)` enforcement, and render loop are all driven by `ALL_LANGUAGES` so they automatically narrow to 2 entries.

---

### `src/lib/validations/onboarding.ts` (edit — remove 'ht' from zod enum)

**File:** `src/lib/validations/onboarding.ts`

Lines 29–35 — `languageSchema`:
```typescript
// BEFORE
// Supported languages: en (English), es (Spanish), ht (Haitian Creole)
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es', 'ht']))
    .min(1, 'At least one language must be selected.'),
})
// AFTER
// D-01 Phase 2: HC removed. Supported languages: en (English), es (Spanish) only.
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es']))
    .min(1, 'At least one language must be selected.'),
})
```

---

### `.env.example` (edit — add RETELL_API_KEY)

**File:** `.env.example`

Current content ends at line 10 with `OAUTH_ENCRYPTION_KEY`. Add after the existing block:
```bash
# Retell AI (Phase 2 Provisioning)
RETELL_API_KEY=your-retell-api-key-here
```

No Twilio credentials needed — phone numbers are provisioned via Retell's API, not directly through Twilio SDK.

---

## Shared Patterns

### Authentication (getUser, not getSession)
**Source:** `src/app/api/onboarding/create-account/route.ts` lines 10–15
**Apply to:** `create/route.ts`, `update-agent/route.ts`
```typescript
const supabase = await createSupabaseServer()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Never use `getSession()` — RESEARCH.md Security Domain ASVS V2.

### Service Role Client
**Source:** `src/lib/supabase/service.ts` lines 1–23
**Apply to:** `create/route.ts`, `update-agent/route.ts`, `retell-agent-sync.ts`
```typescript
import { createServiceRoleClient } from '@/lib/supabase/service'
const serviceClient = createServiceRoleClient()
```
Service role bypasses RLS and is used for all privileged DB writes. Never call `createServiceRoleClient()` in Client Components or pages.

### Ownership Enforcement (never accept contractor_id from request body)
**Source:** `src/app/api/onboarding/create-account/route.ts` lines 27–31
**Apply to:** `create/route.ts`, `update-agent/route.ts`
```typescript
const { data: existing } = await serviceClient
  .from('contractors')
  .select('id, ...')
  .eq('user_id', user.id)  // Always derive contractor from JWT user, never from body
  .maybeSingle()
```

### Error Logging Convention
**Source:** `src/app/api/onboarding/create-account/route.ts` lines 46, 63, 80
**Apply to:** all new API routes and Inngest function steps
```typescript
console.error('[module-name] descriptive action failed:', err.message)
```
Prefix: `[filename-without-extension]`. Never log API keys or full request bodies.

### server-only Enforcement
**Source:** `src/lib/supabase/service.ts` line 5; `src/lib/crypto/tokens.ts` line 4
**Apply to:** `src/lib/retell/client.ts`, `src/inngest/client.ts`, `src/inngest/functions/retell-agent-sync.ts`
```typescript
import 'server-only'
```
Any module holding API keys or calling external services with credentials must start with `import 'server-only'`.

### Zod Validation Pattern
**Source:** `src/app/api/onboarding/create-account/route.ts` lines 17–20
**Apply to:** `create/route.ts`, `update-agent/route.ts`
```typescript
const body = provisionSchema.safeParse(await req.json())
if (!body.success) {
  return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
}
```

### Migration File Structure
**Source:** `supabase/migrations/20260504000003_contractor_defaults.sql` lines 1–3
**Apply to:** `20260506000004_agent_sync_status.sql`
- File header: `-- YYYYMMDDNNN_name.sql`, decision reference, intent description
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for additive changes
- `DROP CONSTRAINT` + `ADD CONSTRAINT` for constraint replacements
- Data migration UPDATE statements run BEFORE new CHECK constraints are applied

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/inngest/functions/retell-agent-sync.ts` | service | event-driven | No Inngest functions exist in the codebase yet; use RESEARCH.md Pattern 4 directly |
| `src/inngest/client.ts` | config | event-driven | No Inngest client exists yet; use RESEARCH.md Pattern 4 directly |

Both files have complete code examples in RESEARCH.md sections "Pattern 3: Retell SDK Client Singleton" and "Pattern 4: Inngest Client + Function Setup" — use those as primary references since no codebase analog exists.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/`, `src/types/`, `src/app/actions/`, `src/app/(dashboard)/`, `supabase/migrations/`, `tests/`
**Files scanned:** 16 source files + 3 migration files
**Pattern extraction date:** 2026-05-06
