---
phase: 02-provisioning
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - supabase/migrations/20260506000004_agent_sync_status.sql
  - .env.example
  - tests/lib/validations.test.ts
  - tests/db/provisioning.test.ts
autonomous: true
requirements:
  - LANG-01
must_haves:
  truths:
    - "retell-sdk@5.18.0 and inngest@4.3.0 appear in package.json dependencies"
    - ".env.example contains RETELL_API_KEY without NEXT_PUBLIC_ prefix"
    - "supabase/migrations/20260506000004_agent_sync_status.sql exists with agent_sync_status and retell_llm_id ADD COLUMN statements"
    - "migration SQL file contains data migration UPDATE statements before DROP CONSTRAINT"
    - "migration SQL file contains ARRAY['en','es']::TEXT[] with no 'ht' in new CHECK constraint"
    - "tests/lib/validations.test.ts stub exists and runs (fails RED — expected)"
    - "tests/db/provisioning.test.ts stub exists and is ready to run after db push"
  artifacts:
    - path: "supabase/migrations/20260506000004_agent_sync_status.sql"
      provides: "Migration SQL file — ALTER TABLE contractors ADD COLUMN agent_sync_status + retell_llm_id; HC constraint removal. NOT yet pushed to live DB (push happens in 02-01b Task 3)."
    - path: "tests/lib/validations.test.ts"
      provides: "Wave 0 stub — HC zod schema rejection test (RED until Plan 02-01b Task 4 removes 'ht')"
    - path: "tests/db/provisioning.test.ts"
      provides: "Wave 0 stub — agent_sync_status column existence test (meaningful after 02-01b Task 3 pushes migration)"
  key_links:
    - from: "supabase/migrations/20260506000004_agent_sync_status.sql"
      to: "supabase db push (02-01b Task 3)"
      via: "migration file must exist and be valid SQL before push runs"
      pattern: "agent_sync_status|retell_llm_id"
    - from: "package.json retell-sdk"
      to: "src/lib/retell/client.ts (Plan 02)"
      via: "npm install makes the package importable"
      pattern: '"retell-sdk"'
---

<objective>
Install missing dependencies (retell-sdk, inngest), create the Phase 2 migration SQL file (agent_sync_status + retell_llm_id columns + HC cleanup), and write Wave 0 test stubs. The migration file is written here but NOT pushed to the live database — that blocking push happens in 02-01b.

Purpose: Parallel setup that Wave 2 plans depend on. Migration SQL must be valid and exist before 02-01b can push it. Wave 0 stubs provide RED anchors for behaviors that must be green by wave end. npm install makes retell-sdk and inngest importable by all subsequent plans.
Output: package.json with retell-sdk@5.18.0 + inngest@4.3.0; supabase/migrations/20260506000004_agent_sync_status.sql; .env.example updated; Wave 0 stubs in tests/.
</objective>

<execution_context>
@/Users/humbertobello/.claude/get-shit-done/workflows/execute-plan.md
@/Users/humbertobello/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-provisioning/02-CONTEXT.md
@.planning/phases/02-provisioning/02-RESEARCH.md
@.planning/phases/02-provisioning/02-PATTERNS.md

<interfaces>
<!-- Types the executor MUST understand before touching any file. Extracted from codebase. -->

From supabase/migrations/20260504000001_initial_schema.sql (for pattern reference):
```sql
-- Existing constraint name to drop:
CONSTRAINT contractor_settings_supported_languages_valid
  CHECK (
    supported_languages <@ ARRAY['en','es','ht']::TEXT[]
    AND array_length(supported_languages, 1) >= 1
  )
-- Also in 20260504000003_contractor_defaults.sql as COMMENT ON CONSTRAINT
```

From .env.example (current state — append to end):
```bash
# Current last line:
OAUTH_ENCRYPTION_KEY=replace-with-64-character-hex-string
# ADD after this:
# Retell AI (Phase 2 Provisioning)
RETELL_API_KEY=your-retell-api-key-here
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Create Wave 0 test stubs (RED anchors)</name>
  <read_first>
    - .planning/phases/02-provisioning/02-VALIDATION.md (read Wave 0 Requirements section to confirm stubs needed)
  </read_first>
  <files>tests/lib/validations.test.ts, tests/db/provisioning.test.ts</files>
  <action>
Create the `tests/lib/` and `tests/db/` directories if they don't exist, then write both stub files.

**tests/lib/validations.test.ts:**
```typescript
// tests/lib/validations.test.ts
// Wave 0 stub — RED anchor for HC removal from zod schema.
// This test FAILS until 02-01b Task 4 (HC code cleanup) changes languageSchema to z.enum(['en','es']).
// D-01: languageSchema must reject 'ht' after Phase 2 cleanup.
import { describe, it, expect } from 'vitest'
import { languageSchema } from '@/lib/validations/onboarding'

describe('languageSchema — HC cleanup (D-01)', () => {
  it('HC cleanup - removes ht from supported_languages schema', () => {
    // This will FAIL (RED) until 02-01b Task 4 removes 'ht' from z.enum.
    // Expected: after cleanup, ['ht'] is rejected.
    expect(
      languageSchema.shape.supported_languages.safeParse(['ht']).success
    ).toBe(false)
  })

  it('accepts valid languages after HC removal', () => {
    expect(
      languageSchema.shape.supported_languages.safeParse(['en']).success
    ).toBe(true)
    expect(
      languageSchema.shape.supported_languages.safeParse(['en', 'es']).success
    ).toBe(true)
  })
})
```

**tests/db/provisioning.test.ts:**
```typescript
// tests/db/provisioning.test.ts
// Wave 0 stub — checks that agent_sync_status column exists in live Supabase contractors table.
// Requires: supabase db push (02-01b Task 3) must complete before this test is meaningful.
// D-12: agent_sync_status column added by migration 20260506000004_agent_sync_status.sql.
import { describe, it, expect } from 'vitest'
import { createServiceRoleClient } from '@/lib/supabase/service'

describe('contractors table — Phase 2 schema (D-12)', () => {
  it('agent_sync_status column exists in contractors table', async () => {
    // This integration test queries live Supabase.
    // Run AFTER supabase db push (02-01b Task 3) completes.
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('contractors')
      .select('agent_sync_status')
      .limit(1)
    // If column doesn't exist, Supabase returns a column-not-found error
    expect(error).toBeNull()
    // data can be [] (no rows) or [{ agent_sync_status: null }] — both are valid
  })

  it('retell_llm_id column exists in contractors table', async () => {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('contractors')
      .select('retell_llm_id')
      .limit(1)
    expect(error).toBeNull()
  })
})
```

Note: The validations.test.ts stub will be RED until 02-01b Task 4 changes the zod enum. This is intentional — Wave 0 stubs anchor the TDD cycle. Do NOT make them GREEN prematurely. Run `npx vitest run tests/lib/validations.test.ts` to confirm it fails before 02-01b Task 4.
  </action>
  <verify>
    <automated>ls tests/lib/validations.test.ts && ls tests/db/provisioning.test.ts && npx vitest run tests/lib/validations.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|Tests"</automated>
  </verify>
  <done>Wave 0 test stubs created. validations.test.ts is RED (expected). provisioning.test.ts is ready to run after db push in 02-01b.</done>
</task>

<task type="auto">
  <name>Task 1: Install retell-sdk and inngest, update .env.example</name>
  <read_first>
    - package.json (verify retell-sdk and inngest are absent before installing)
    - .env.example (read before appending to avoid duplicates)
  </read_first>
  <files>package.json, package-lock.json, .env.example</files>
  <action>
Run: `npm install retell-sdk@5.18.0 inngest@4.3.0`

Do NOT install twilio — per RESEARCH.md Assumptions A4, twilio is not needed in Phase 2 (provisioning goes through Retell's API). If twilio is added, tsc will import its types and may surface type errors unrelated to this phase.

After installation, append to .env.example (add after the OAUTH_ENCRYPTION_KEY line):
```
# Retell AI (Phase 2 Provisioning)
RETELL_API_KEY=your-retell-api-key-here
```

Do NOT add `NEXT_PUBLIC_` prefix to RETELL_API_KEY — this is a server-only secret (Critical Rule #3; STRIDE threat T-02-02 in threat_model below).
  </action>
  <verify>
    <automated>grep '"retell-sdk"' package.json && grep '"inngest"' package.json && grep 'RETELL_API_KEY' .env.example</automated>
  </verify>
  <done>Both packages installed and env example updated.</done>
</task>

<task type="auto">
  <name>Task 2: Write migration 20260506000004_agent_sync_status.sql (HC cleanup + new columns)</name>
  <read_first>
    - supabase/migrations/20260504000001_initial_schema.sql (verify constraint name contractor_settings_supported_languages_valid and calls.language CHECK name)
    - supabase/migrations/20260504000003_contractor_defaults.sql (verify COMMENT ON CONSTRAINT text to understand what we're replacing)
    - .planning/phases/02-provisioning/02-RESEARCH.md (Schema Changes Required section — full SQL provided)
  </read_first>
  <files>supabase/migrations/20260506000004_agent_sync_status.sql</files>
  <action>
Create the file `supabase/migrations/20260506000004_agent_sync_status.sql` with the following content exactly:

```sql
-- 20260506000004_agent_sync_status.sql
-- Phase 2: Provisioning — adds agent_sync_status and retell_llm_id to contractors;
-- removes Haitian Creole ('ht') from supported_languages CHECK, emergency_keywords DEFAULT,
-- and calls.language CHECK.
-- D-01: HC removed from product scope entirely.
-- D-12: agent_sync_status tracks Retell sync state; shown as banner in Phase 6 portal.
-- retell_llm_id: needed for PATCH /update-retell-llm/{llm_id} on settings changes (Phase 6).

-- 1. Add new columns to contractors
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS agent_sync_status TEXT
    CHECK (agent_sync_status IS NULL OR agent_sync_status IN ('synced', 'failed', 'pending')),
  ADD COLUMN IF NOT EXISTS retell_llm_id TEXT;

-- 2. Data migration: remove 'ht' from existing supported_languages arrays
UPDATE contractor_settings
  SET supported_languages = array_remove(supported_languages, 'ht')
  WHERE 'ht' = ANY(supported_languages);

-- 3. Fallback: if array is now empty, default to ['en']
UPDATE contractor_settings
  SET supported_languages = ARRAY['en']::TEXT[]
  WHERE array_length(supported_languages, 1) = 0 OR supported_languages IS NULL;

-- 4. Remove 'ht' key from existing emergency_keywords JSONB rows
UPDATE contractor_settings
  SET emergency_keywords = emergency_keywords - 'ht'
  WHERE emergency_keywords ? 'ht';

-- 5. Drop + replace supported_languages CHECK constraint (removes 'ht')
ALTER TABLE contractor_settings
  DROP CONSTRAINT contractor_settings_supported_languages_valid;

ALTER TABLE contractor_settings
  ADD CONSTRAINT contractor_settings_supported_languages_valid
    CHECK (
      supported_languages <@ ARRAY['en','es']::TEXT[]
      AND array_length(supported_languages, 1) >= 1
    );

COMMENT ON CONSTRAINT contractor_settings_supported_languages_valid
  ON contractor_settings
  IS 'D-01 Phase 2: supported_languages must be a non-empty subset of {en, es} — HC removed from product scope';

-- 6. Update emergency_keywords DEFAULT to remove 'ht' key going forward
ALTER TABLE contractor_settings
  ALTER COLUMN emergency_keywords
  SET DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"]
  }'::JSONB;

-- 7. Drop + replace calls.language CHECK constraint (removes 'ht')
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_language_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_language_check
    CHECK (language IS NULL OR language IN ('en', 'es'));
```

IMPORTANT: Do NOT modify the existing migration files (20260504000001, 20260504000002, 20260504000003) — they are committed history. The new migration overrides their defaults and constraints going forward.

NOTE: This task writes the SQL file only. The `supabase db push` that applies it to the live database is Task 3 of plan 02-01b. Do NOT run `supabase db push` in this task.
  </action>
  <verify>
    <automated>ls supabase/migrations/20260506000004_agent_sync_status.sql && grep 'agent_sync_status' supabase/migrations/20260506000004_agent_sync_status.sql && grep 'retell_llm_id' supabase/migrations/20260506000004_agent_sync_status.sql && grep "ARRAY\['en','es'\]" supabase/migrations/20260506000004_agent_sync_status.sql</automated>
  </verify>
  <done>Migration file exists with all required SQL. db push is NOT run here — that is 02-01b Task 3.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| env vars → server modules | RETELL_API_KEY must never cross to browser (NEXT_PUBLIC_ prefix forbidden) |
| migration files → live DB | SQL runs as privileged role; HC data migration must clean rows before CHECK constraint applies (push happens in 02-01b) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering | supabase/migrations/20260506000004_agent_sync_status.sql | mitigate | Data migration UPDATE statements placed BEFORE DROP CONSTRAINT + ADD CONSTRAINT; ensures no existing rows violate new CHECK when push runs in 02-01b |
| T-02-02 | Information Disclosure | .env.example RETELL_API_KEY | mitigate | Key added without NEXT_PUBLIC_ prefix; comment in file warns server-only; `grep NEXT_PUBLIC_RETELL .env.example` must return empty |
</threat_model>

<verification>
After all tasks complete:

1. `grep '"retell-sdk"' package.json` — outputs `"retell-sdk": "5.18.0"`
2. `grep '"inngest"' package.json` — outputs `"inngest": "4.3.0"`
3. `grep 'RETELL_API_KEY' .env.example` — matches; no NEXT_PUBLIC_ prefix
4. `ls supabase/migrations/20260506000004_agent_sync_status.sql` — file exists
5. `grep 'agent_sync_status' supabase/migrations/20260506000004_agent_sync_status.sql` — matches
6. `grep 'retell_llm_id' supabase/migrations/20260506000004_agent_sync_status.sql` — matches
7. `grep "ARRAY\['en','es'\]" supabase/migrations/20260506000004_agent_sync_status.sql` — matches
8. `ls tests/lib/validations.test.ts && ls tests/db/provisioning.test.ts` — both exist
</verification>

<success_criteria>
- retell-sdk@5.18.0 and inngest@4.3.0 installed in package.json
- .env.example has RETELL_API_KEY (no NEXT_PUBLIC_ prefix)
- Migration SQL file written with correct content (data migration before constraint change, no 'ht' in new CHECK)
- tests/lib/validations.test.ts exists and is RED (intentional Wave 0 anchor)
- tests/db/provisioning.test.ts exists and is ready to run after 02-01b pushes the migration
- Plan 02-01b can now proceed: it depends_on this plan completing
</success_criteria>

<output>
After completion, create `.planning/phases/02-provisioning/02-01a-SUMMARY.md` using the summary template at `@/Users/humbertobello/.claude/get-shit-done/templates/summary.md`.
</output>
