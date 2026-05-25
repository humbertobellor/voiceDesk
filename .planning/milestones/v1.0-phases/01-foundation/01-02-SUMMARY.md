---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgresql, rls, schema, migrations, multi-language, idempotency]

# Dependency graph
requires:
  - 01-01 (Next.js scaffold — project directory and git repo)
provides:
  - 3 Supabase SQL migration files with all 9 tables, 9 RLS-enable statements, 33 explicit RLS policies
  - supabase/config.toml for Supabase CLI use in Plan 03
  - LANG-02 enforced at DB layer via CHECK constraint on supported_languages
  - D-16 webhook idempotency enforced at DB layer via UNIQUE (source, event_type, external_id)
  - D-17 calendar_credentials columns (access_token, refresh_token TEXT NOT NULL) ready for Plan 03 AES-256-GCM
  - Phase 4 booking conflict lock via UNIQUE (contractor_id, starts_at) on appointments
  - D-11 emergency keyword JSONB defaults for en/es/ht (sant gaz, olor a gas, gas smell)
affects: [01-03, 01-04, 01-05, 02-01, 03-01, 04-01, 05-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS Pattern A: contractors table uses direct user_id match (SELECT auth.uid()) = user_id"
    - "RLS Pattern B: 7 FK tables use subquery contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))"
    - "RLS Pattern C: webhook_events deny-all (USING false / WITH CHECK false) — service role bypasses RLS"
    - "All auth.uid() calls wrapped in (SELECT auth.uid()) for query plan caching"
    - "Every INSERT policy has explicit WITH CHECK; every UPDATE has both USING and WITH CHECK"
    - "ALTER TABLE ... ENABLE ROW LEVEL SECURITY immediately after CREATE TABLE in same migration (CLAUDE.md Rule 1)"

key-files:
  created:
    - supabase/config.toml
    - supabase/migrations/20260504000001_initial_schema.sql
    - supabase/migrations/20260504000002_rls_policies.sql
    - supabase/migrations/20260504000003_contractor_defaults.sql
  modified: []

key-decisions:
  - "RLS enabled in same migration as CREATE TABLE (not deferred to migration 2) — CLAUDE.md Critical Rule 1"
  - "33 policies = 4 ops x 8 user-facing tables + 1 deny-all for webhook_events (Pattern C)"
  - "supported_languages CHECK uses <@ ARRAY['en','es','ht'] AND array_length >= 1 (Pitfall 5 — rejects empty arrays)"
  - "JSONB defaults documented in BOTH migration 1 (source of truth) and migration 3 (re-affirmation guard)"
  - "Live application deferred to Plan 03 supabase db push"

requirements-completed:
  - LANG-02

# Metrics
duration: 12min
completed: 2026-05-04
---

# Phase 1 Plan 02: Supabase Schema + RLS Migrations Summary

**All 9 Supabase tables with RLS enabled in the same migration, 33 explicit RLS policies covering 4 operations per user-facing table plus deny-all for webhook_events, and JSONB defaults for multi-language emergency keywords (English/Spanish/Haitian Creole)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-04T10:32:00Z
- **Completed:** 2026-05-04
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `supabase/config.toml` with CLI-ready config for Plan 03 `supabase link` / `supabase db push`
- Wrote `20260504000001_initial_schema.sql` with all 9 tables (contractors, contractor_settings, calls, leads, appointments, calendar_credentials, webhook_events, notification_log, notification_settings) — every CREATE TABLE immediately followed by ALTER TABLE ENABLE ROW LEVEL SECURITY
- Wrote `20260504000002_rls_policies.sql` with exactly 33 CREATE POLICY statements — 4 per user-facing table (SELECT/INSERT/UPDATE/DELETE) + 1 deny-all for webhook_events
- Wrote `20260504000003_contractor_defaults.sql` re-affirming D-10/D-11 JSONB defaults and LANG-02 CHECK constraint as a guard against future migration drift
- LANG-02 delivered: CHECK constraint enforces `supported_languages <@ ARRAY['en','es','ht'] AND array_length >= 1`
- D-16 idempotency key delivered: UNIQUE (source, event_type, external_id) on webhook_events
- Phase 4 booking lock delivered: UNIQUE (contractor_id, starts_at) on appointments

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase config + migration 1 (9 tables + RLS + indexes + constraints)** — `8946352` (feat)
2. **Task 2: Migration 2 (33 RLS policies) + migration 3 (defaults verification)** — `d35a08f` (feat)

## Files Created/Modified

- `supabase/config.toml` — Supabase CLI config; project_id placeholder for Plan 03 supabase link
- `supabase/migrations/20260504000001_initial_schema.sql` — 231 lines; 9 CREATE TABLE + 9 ENABLE ROW LEVEL SECURITY + all CHECK constraints + UNIQUE constraints + indexes
- `supabase/migrations/20260504000002_rls_policies.sql` — 208 lines; 33 CREATE POLICY statements using (SELECT auth.uid()) for query plan caching
- `supabase/migrations/20260504000003_contractor_defaults.sql` — 43 lines; re-affirms D-10/D-11 JSONB defaults and LANG-02 COMMENT ON CONSTRAINT

## Decisions Made

- RLS enabled in same migration as CREATE TABLE (migration 1), not deferred to migration 2 — per CLAUDE.md Critical Rule 1 exact wording
- 33 policies (not 32 or 36) — 4 ops x 8 user-facing tables + 1 deny-all for webhook_events (Pattern C uses FOR ALL TO authenticated, anon with USING(false))
- `(SELECT auth.uid())` wrapper on all auth.uid() calls (40 occurrences) — prevents per-row function re-evaluation, following RESEARCH.md line 745
- JSONB defaults appear in both migration 1 (canonical) AND migration 3 (re-affirmation) — any future migration that drops them must update both files

## Deviations from Plan

None — plan executed exactly as written. All SQL in the plan was implemented verbatim including the exact JSONB default values for all three language keyword lists.

## Known Stubs

None — all columns and constraints are complete. Live application is intentionally deferred to Plan 03's `supabase db push` step.

## Threat Flags

No new threat surface beyond what was already captured in the plan's threat model. The migrations implement all 6 threat mitigations from the STRIDE register (T-1-02, T-1-03, T-1-S5, T-1-S6, T-1-S7, T-1-S8).

## Issues Encountered

None beyond expected scope. No external services required for this plan.

## Next Phase Readiness

- Plan 03 (crypto utility + supabase db push) can proceed — config.toml is in place, migrations are written
- Plan 03's `supabase db push` is the LIVE syntax check; any SQL syntax errors will surface there
- Plan 04 (auth pages + middleware) can reference the contractors and contractor_settings table columns
- Plan 05 (RLS tests) can test the exact policy names from migration 2 (`contractors_select_own`, etc.)

## Self-Check: PASSED

All 4 files verified on disk. Both task commits confirmed in git log (8946352, d35a08f).
Schema invariants verified: 9 CREATE TABLE, 9 ENABLE ROW LEVEL SECURITY, 33 CREATE POLICY, 1 LANG-02 CHECK, 1 D-16 idempotency key.

---
*Phase: 01-foundation*
*Completed: 2026-05-04*
