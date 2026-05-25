---
phase: 02-provisioning
plan: 01b
type: execute
wave: 1
depends_on:
  - 02-01a
files_modified:
  - src/types/database.ts
  - src/lib/validations/onboarding.ts
  - src/app/actions/settings.ts
  - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
  - .planning/REQUIREMENTS.md
  - .planning/phases/02-provisioning/02-VALIDATION.md
autonomous: false
requirements:
  - LANG-01
must_haves:
  truths:
    - "supabase db push exits 0 with migration 20260506000004 applied"
    - "contractors table has agent_sync_status and retell_llm_id columns in live DB"
    - "Language type in database.ts is 'en' | 'es' only — 'ht' removed"
    - "EmergencyKeywords interface has no ht field"
    - "Contractor interface has retell_llm_id and agent_sync_status fields"
    - "languageSchema zod enum accepts only 'en' and 'es'"
    - "LanguageSettingsForm.tsx ALL_LANGUAGES array has 2 entries (English, Spanish)"
    - "npx tsc --noEmit exits 0 after all changes"
    - "npx vitest run tests/lib/validations.test.ts exits 0 with all tests GREEN"
    - "VALIDATION.md frontmatter has nyquist_compliant: true and wave_0_complete: true"
    - "VALIDATION.md row 2-01-03 shows Plan: 02 and Wave: 2"
    - "tests/lib/retell-language-mapper.test.ts is NOT listed in the Wave 0 Requirements checklist"
  artifacts:
    - path: "src/types/database.ts"
      provides: "Language = 'en' | 'es'; EmergencyKeywords without ht; Contractor with retell_llm_id + agent_sync_status"
    - path: "src/lib/validations/onboarding.ts"
      provides: "languageSchema z.enum(['en','es'])"
    - path: ".planning/phases/02-provisioning/02-VALIDATION.md"
      provides: "Updated with nyquist_compliant: true, wave_0_complete: true, corrected row 2-01-03"
  key_links:
    - from: "src/types/database.ts Language type"
      to: "src/lib/validations/onboarding.ts z.enum"
      via: "both must agree on supported language codes"
      pattern: "Language.*'en'.*'es'"
    - from: "supabase/migrations/20260506000004_agent_sync_status.sql"
      to: "contractors table (live DB)"
      via: "supabase db push"
      pattern: "agent_sync_status|retell_llm_id"
---

<objective>
Run the [BLOCKING] `supabase db push` to apply migration 20260506000004 to the live database, then remove all Haitian Creole references from TypeScript types, zod validation, settings action, and UI component, and update VALIDATION.md sign-off.

Purpose: The db push is the gate for all Wave 2 plans — no runtime provisioning will work without the new columns. HC cleanup in code must match the DB constraint change. VALIDATION.md update closes the Wave 0 tracking loop.
Output: Live DB with agent_sync_status + retell_llm_id columns; HC removed from all code; tsc clean; validations.test.ts GREEN; VALIDATION.md updated.
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
@.planning/phases/02-provisioning/02-01a-SUMMARY.md

<interfaces>
<!-- Types the executor MUST understand before touching any file. Extracted from codebase. -->

From src/types/database.ts (current state — executor MUST edit this file):
```typescript
export type Language = 'en' | 'es' | 'ht'          // CHANGE TO: 'en' | 'es'
export interface EmergencyKeywords {
  en: string[]
  es: string[]
  ht: string[]                                       // REMOVE this field
}
export interface Contractor {
  // ... existing fields including retell_agent_id ...
  // ADD after retell_agent_id line:
  // retell_llm_id: string | null
  // agent_sync_status: 'synced' | 'failed' | 'pending' | null
}
```

From src/lib/validations/onboarding.ts (current state):
```typescript
// Line 29-34 — CHANGE 'ht' to remove from enum:
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es', 'ht']))   // CHANGE TO: z.enum(['en', 'es'])
    .min(1, 'At least one language must be selected.'),
})
```

From src/app/actions/settings.ts (current state):
```typescript
// Line 16 comment — UPDATE text:
// 2. Validate input against Plan 03 zod schema (LANG-02 floor: ['en'|'es'|'ht'][], min 1)
// CHANGE TO:
// 2. Validate input against zod schema (supported: ['en'|'es'], min 1; D-01 Phase 2 removes 'ht')
```

From src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx (current state):
```typescript
// Lines 11-15 — ALL_LANGUAGES array, REMOVE Haitian Creole entry:
const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'ht', label: 'Haitian Creole' },   // REMOVE THIS LINE
]
```
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: [BLOCKING] supabase db push — apply migration to live database</name>
  <what-built>
Plan 02-01a Task 2 wrote supabase/migrations/20260506000004_agent_sync_status.sql. This task applies it to the live Supabase project.

Run: `supabase db push`

If the command requires interactive confirmation, set `SUPABASE_ACCESS_TOKEN` from your local environment and re-run.

After push succeeds, verify columns are live:
```bash
supabase db dump --schema public --no-owner 2>/dev/null | grep -E 'agent_sync_status|retell_llm_id' | head -5
```

FAILURE HANDLING: If `supabase db push` exits non-zero, STOP immediately. Do NOT proceed to Task 4. Diagnose the error — most common causes:
- Migration SQL syntax error → fix the SQL in 20260506000004_agent_sync_status.sql, re-run
- Constraint name conflict → the DROP CONSTRAINT must run before ADD CONSTRAINT; verify order in SQL file
- Auth error → ensure SUPABASE_ACCESS_TOKEN is set or run `supabase login` first

RLS NOTE: This migration adds `agent_sync_status` and `retell_llm_id` columns to the `contractors` table. Existing Phase 1 row-level policies apply to new columns automatically in Supabase RLS (policies are row-level, not column-level). No additional RLS statements needed:
```bash
grep -E 'CREATE POLICY.*contractors' supabase/migrations/20260504000002_rls_policies.sql
# Should return exactly 4 lines (SELECT, INSERT, UPDATE, DELETE)
```
  </what-built>
  <how-to-verify>
    1. Run `supabase db push` — must exit 0
    2. Confirm migration 20260506000004_agent_sync_status.sql is listed as applied in the output
    3. Run `supabase db dump --schema public 2>/dev/null | grep agent_sync_status` — must return at least one line
    4. Run `supabase db dump --schema public 2>/dev/null | grep retell_llm_id` — must return at least one line
  </how-to-verify>
  <resume-signal>Type "push succeeded" once supabase db push exits 0 and columns are confirmed in live DB, or describe any errors</resume-signal>
</task>

<task type="auto">
  <name>Task 4: HC code cleanup — database.ts, validations, settings action, LanguageSettingsForm</name>
  <read_first>
    - src/types/database.ts (read full file — change Language type, EmergencyKeywords interface, add fields to Contractor)
    - src/lib/validations/onboarding.ts (read full file — change z.enum in languageSchema)
    - src/app/actions/settings.ts (read full file — update comment on line 16)
    - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx (read full file — remove ht entry from ALL_LANGUAGES)
    - .planning/REQUIREMENTS.md (read LANG-02 traceability row — update status)
  </read_first>
  <files>
    src/types/database.ts,
    src/lib/validations/onboarding.ts,
    src/app/actions/settings.ts,
    src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx,
    .planning/REQUIREMENTS.md
  </files>
  <action>
Make EXACTLY these changes to each file:

**src/types/database.ts:**

1. Change Language type:
   FROM: `export type Language = 'en' | 'es' | 'ht'`
   TO:   `export type Language = 'en' | 'es'`

2. Remove `ht: string[]` from EmergencyKeywords:
   FROM:
   ```typescript
   export interface EmergencyKeywords {
     en: string[]
     es: string[]
     ht: string[]
   }
   ```
   TO:
   ```typescript
   export interface EmergencyKeywords {
     en: string[]
     es: string[]
   }
   ```

3. After the `retell_agent_id: string | null` line in the Contractor interface, ADD:
   ```typescript
   retell_llm_id: string | null
   agent_sync_status: 'synced' | 'failed' | 'pending' | null
   ```

**src/lib/validations/onboarding.ts:**

4. Update languageSchema:
   FROM:
   ```typescript
   // Supported languages: en (English), es (Spanish), ht (Haitian Creole)
   export const languageSchema = z.object({
     supported_languages: z
       .array(z.enum(['en', 'es', 'ht']))
       .min(1, 'At least one language must be selected.'),
   })
   ```
   TO:
   ```typescript
   // D-01 Phase 2: HC removed. Supported languages: en (English), es (Spanish) only.
   export const languageSchema = z.object({
     supported_languages: z
       .array(z.enum(['en', 'es']))
       .min(1, 'At least one language must be selected.'),
   })
   ```

**src/app/actions/settings.ts:**

5. Update comment only (no logic change):
   FROM: `// 2. Validate input against Plan 03 zod schema (LANG-02 floor: ['en'|'es'|'ht'][], min 1)`
   TO:   `// 2. Validate input against zod schema (supported: ['en'|'es'], min 1; D-01 Phase 2 removes 'ht')`

**src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx:**

6. Remove the `{ code: 'ht', label: 'Haitian Creole' }` line from ALL_LANGUAGES array. Result should be:
   ```typescript
   const ALL_LANGUAGES: { code: Language; label: string }[] = [
     { code: 'en', label: 'English' },
     { code: 'es', label: 'Spanish' },
   ]
   ```

**.planning/REQUIREMENTS.md:**

7. Find the LANG-02 traceability row:
   `| LANG-02 | Phase 1 — Foundation | Validated 2026-05-05 |`
   Update the status column:
   TO: `| LANG-02 | Phase 1 — Foundation | Out of Scope (D-01 Phase 2 — HC removed from product) |`

After all edits, run: `npx tsc --noEmit`
This must exit 0. If there are type errors, fix them before marking this task done.

After tsc passes, run: `npx vitest run tests/lib/validations.test.ts --reporter=verbose`
Both tests in the HC cleanup describe block should now be GREEN (the stub created in 02-01a Task 0 will pass once 'ht' is removed from the enum).
  </action>
  <verify>
    <automated>grep "Language = 'en' | 'es'" src/types/database.ts && grep "retell_llm_id" src/types/database.ts && grep "agent_sync_status" src/types/database.ts && grep "z.enum\(\['en', 'es'\]\)" src/lib/validations/onboarding.ts && grep -v "Haitian Creole" src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx && npx tsc --noEmit && npx vitest run tests/lib/validations.test.ts --reporter=verbose 2>&1 | grep -E "PASS|Tests"</automated>
  </verify>
  <done>All 'ht' references removed from code. TypeScript compiles clean. validations.test.ts is GREEN.</done>
</task>

<task type="auto">
  <name>Task 5: Update VALIDATION.md sign-off (Wave 0 complete, fix row 2-01-03)</name>
  <read_first>
    - .planning/phases/02-provisioning/02-VALIDATION.md (read full file — update frontmatter, fix row 2-01-03, update sign-off checklist)
  </read_first>
  <files>.planning/phases/02-provisioning/02-VALIDATION.md</files>
  <action>
Update the VALIDATION.md file with three changes:

**1. Frontmatter — change:**
   - `nyquist_compliant: false` → `nyquist_compliant: true`
   - `wave_0_complete: false` → `wave_0_complete: true`

**2. Per-Task Verification Map — fix row 2-01-03:**
   The current row 2-01-03 incorrectly shows Plan 01 Wave 1 for `tests/lib/retell-language-mapper.test.ts`.
   This file is created in Plan 02 Task 1 (Wave 2), not as a Wave 0 item in Plan 01.

   FROM:
   ```
   | 2-01-03 | 01 | 1 | LANG-01 | — | N/A | unit | `npx vitest run tests/lib/retell-language-mapper.test.ts -x` | ❌ W0 | ⬜ pending |
   ```
   TO:
   ```
   | 2-01-03 | 02 | 2 | LANG-01 | — | N/A | unit | `npx vitest run tests/lib/retell-language-mapper.test.ts -x` | ❌ | ⬜ pending |
   ```
   (Plan: 02, Wave: 2, remove the "W0" marker — this is a Wave 2 deliverable, not a Wave 0 requirement)

**3. Wave 0 Requirements section — remove retell-language-mapper.test.ts:**
   FROM the Wave 0 Requirements checklist, find and remove this line:
   `- [ ] \`tests/lib/retell-language-mapper.test.ts\` — locale code mapping ...`

   This file is delivered by Plan 02 as a Wave 2 task (TDD test for toRetellLanguage). It is NOT a Wave 0 prerequisite. Removing it from the Wave 0 list is correct — Wave 0 only requires items that must exist before their own plan's tasks run.

   After removing retell-language-mapper.test.ts, mark the remaining Wave 0 items that Plan 02-01a and 02-01b deliver as checked:
   - `[x] tests/lib/validations.test.ts` — created in 02-01a Task 0
   - `[x] tests/db/provisioning.test.ts` — created in 02-01a Task 0
   - `[x] Package installs: npm install retell-sdk@5.18.0 inngest@4.3.0` — done in 02-01a Task 1
   Keep unchecked (delivered by Plans 02/03/04):
   - `[ ] tests/lib/system-prompt.test.ts` — Plan 02
   - `[ ] tests/api/provisioning.test.ts` — Plan 04
   - `[ ] src/app/api/inngest/route.ts` — Plan 03

**4. Validation Sign-Off checklist — mark applicable items checked:**
   - `[x] All tasks have <automated> verify or Wave 0 dependencies`
   - `[x] Sampling continuity: no 3 consecutive tasks without automated verify`
   - `[x] Wave 0 covers all MISSING references` (for the items Plans 02-01a/b deliver)
   - `[x] No watch-mode flags`
   - `[x] Feedback latency < 15s`
   - `[x] nyquist_compliant: true set in frontmatter`

**5. Approval line:**
   FROM: `**Approval:** pending`
   TO:   `**Approval:** Wave 0 items from Plans 02-01a and 02-01b complete — remaining items (system-prompt.test.ts, api/inngest/route.ts, tests/api/provisioning.test.ts) delivered by Plans 02, 03, and 04`
  </action>
  <verify>
    <automated>grep 'nyquist_compliant: true' .planning/phases/02-provisioning/02-VALIDATION.md && grep 'wave_0_complete: true' .planning/phases/02-provisioning/02-VALIDATION.md && grep '| 2-01-03 | 02 | 2 |' .planning/phases/02-provisioning/02-VALIDATION.md</automated>
  </verify>
  <done>VALIDATION.md updated: nyquist_compliant: true, wave_0_complete: true, row 2-01-03 shows Plan 02 Wave 2, retell-language-mapper.test.ts removed from Wave 0 checklist.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| migration files → live DB | SQL runs as privileged role; HC data migration must clean rows before CHECK constraint applies |
| TypeScript types → runtime | Language type change propagates to all consumers; tsc exit 0 confirms no silent type widening |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01b-01 | Tampering | supabase db push | mitigate | Data migration UPDATE statements in 20260506000004 run BEFORE DROP CONSTRAINT + ADD CONSTRAINT; no existing rows violate the new CHECK |
| T-02-01b-02 | Tampering | src/types/database.ts Language type | mitigate | Type change propagates automatically to all consumers via TypeScript — tsc --noEmit confirms no silent type widening |
</threat_model>

<verification>
After all tasks complete:

1. `supabase db push` — exits 0 (idempotent re-run is fine)
2. `supabase db dump --schema public 2>/dev/null | grep agent_sync_status` — returns at least one line
3. `supabase db dump --schema public 2>/dev/null | grep retell_llm_id` — returns at least one line
4. `npx tsc --noEmit` — exits 0
5. `grep "Language = 'en' | 'es'" src/types/database.ts` — matches
6. `grep "z.enum\(\['en', 'es'\]\)" src/lib/validations/onboarding.ts` — matches
7. `grep -c "Haitian Creole" src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` — outputs 0
8. `npx vitest run tests/lib/validations.test.ts --reporter=verbose` — exits 0, all tests GREEN
9. `grep 'nyquist_compliant: true' .planning/phases/02-provisioning/02-VALIDATION.md` — matches
10. `grep 'wave_0_complete: true' .planning/phases/02-provisioning/02-VALIDATION.md` — matches
11. `grep '| 2-01-03 | 02 | 2 |' .planning/phases/02-provisioning/02-VALIDATION.md` — matches
</verification>

<success_criteria>
- supabase db push exits 0 with migration 20260506000004 applied
- contractors table has agent_sync_status (TEXT CHECK IN ('synced','failed','pending') or NULL) and retell_llm_id (TEXT) columns
- supported_languages CHECK constraint in DB accepts only {en, es} — 'ht' rejected at DB level
- Language TypeScript type is 'en' | 'es' — tsc exits 0 throughout the codebase
- LanguageSettingsForm renders 2 checkboxes (English, Spanish) — Haitian Creole removed
- REQUIREMENTS.md LANG-02 marked Out of Scope (D-01)
- tests/lib/validations.test.ts is GREEN after HC cleanup
- VALIDATION.md has nyquist_compliant: true and wave_0_complete: true
- VALIDATION.md row 2-01-03 shows Plan 02 Wave 2 (not Plan 01 Wave 0)
- Wave 2 plans can now safely import retell-sdk and inngest, and use the correct Language type
</success_criteria>

<output>
After completion, create `.planning/phases/02-provisioning/02-01b-SUMMARY.md` using the summary template at `@/Users/humbertobello/.claude/get-shit-done/templates/summary.md`.
</output>
