---
phase: 04-scheduling-lead-capture
plan: "01"
subsystem: scheduling-infrastructure
tags: [googleapis, migration, tdd-stubs, google-calendar, wave-0]
dependency_graph:
  requires: [03-04]
  provides: [04-02, 04-03, 04-04, 04-05, 04-06]
  affects: [supabase-live-db, test-infrastructure]
tech_stack:
  added: [googleapis@^171.4.0]
  patterns: [TDD-RED-stubs, ADD-COLUMN-IF-NOT-EXISTS, vi.hoisted-mock-pattern]
key_files:
  created:
    - supabase/migrations/20260508000008_phase4_scheduling.sql
    - tests/lib/scheduling.test.ts
    - tests/lib/booking.test.ts
    - tests/lib/leads.test.ts
    - tests/lib/oauth.test.ts
  modified:
    - package.json
    - package-lock.json
    - .env.example
decisions:
  - "googleapis installed as production dependency for Google Calendar API and OAuth2Client"
  - "booking_conflict placed on leads table (NOT appointments) per D-10 architectural fix — UNIQUE constraint on appointments makes a second same-slot row structurally impossible"
  - "google_sync_status NOT NULL with DEFAULT 'pending' to prevent ambiguous NULL states (mirrors analysis_status pattern from Phase 3)"
  - "CASA Tier 2 warning comment added to .env.example for calendar.events restricted scope"
metrics:
  duration: "~12 min"
  completed: "2026-05-08T19:56:38Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 3
---

# Phase 4 Plan 01: Wave-0 Infrastructure Summary

**One-liner:** googleapis installed, three Phase 4 DB columns live via migration, and 19 TDD stub tests created in RED phase to gate all downstream plans.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install googleapis and update .env.example | 91cb735 | package.json, package-lock.json, .env.example |
| 2 | Write Phase 4 migration SQL file | c83d9f9 | supabase/migrations/20260508000008_phase4_scheduling.sql |
| 3 | Push migration to live database | c83d9f9 | (DB operation — no new file) |
| 4 | Create all four Wave-0 test stub files | 545889b | tests/lib/scheduling.test.ts, tests/lib/booking.test.ts, tests/lib/leads.test.ts, tests/lib/oauth.test.ts |

---

## What Was Built

### 1. googleapis Installed

`npm install googleapis` added `googleapis@^171.4.0` to production dependencies. This is the official Google Node.js client library needed for OAuth2Client, Calendar API v3 events, and token refresh in Plans 02-04.

### 2. .env.example Updated with Google OAuth Vars

Three env vars added after `OPENAI_API_KEY`:
- `GOOGLE_CLIENT_ID` — Google Cloud Console OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` — OAuth client secret (server-only, never NEXT_PUBLIC_)
- `GOOGLE_REDIRECT_URI` — Must match Authorized Redirect URI in Google Cloud Console

A CASA Tier 2 restricted-scope warning block was added above these vars to ensure future developers understand that the `calendar.events` scope requires CASA Tier 2 security assessment before any beta contractor connects their calendar.

### 3. Phase 4 Migration SQL

`supabase/migrations/20260508000008_phase4_scheduling.sql` adds three columns to existing tables:

1. `contractor_settings.appointment_duration_minutes INT NOT NULL DEFAULT 120` — D-06: default 2 hours; Phase 6 portal will expose 60/90/120/180 min selector
2. `appointments.google_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (... IN ('pending', 'synced', 'failed', 'skipped'))` — D-14: tracks Google Calendar event sync lifecycle
3. `leads.booking_conflict BOOLEAN NOT NULL DEFAULT false` — D-10: flags leads where the requested appointment slot had a race condition UNIQUE constraint violation

All three use `ADD COLUMN IF NOT EXISTS` — idempotent and safe to re-run. No new RLS policies needed — existing policies in `20260504000002_rls_policies.sql` cover all four operations on these tables and automatically cover new columns.

### 4. Migration Pushed to Live Database

`npx supabase db push` applied `20260508000008_phase4_scheduling.sql` to the live Supabase project. Confirmed via `npx supabase migration list` — both Local and Remote columns show `20260508000008`.

### 5. Four Wave-0 TDD Stub Files

All 19 stub tests throw `new Error('not yet implemented')` — correct TDD RED phase:

| File | Tests | Requirements | Mock Setup |
|------|-------|-------------|------------|
| tests/lib/scheduling.test.ts | 5 | SCHED-01, SCHED-02 | None (pure function) |
| tests/lib/booking.test.ts | 4 | SCHED-04 | vi.hoisted + supabase service + googleapis |
| tests/lib/leads.test.ts | 6 | SCHED-01, D-12 | vi.hoisted + supabase service |
| tests/lib/oauth.test.ts | 4 | D-05 | vi.hoisted + supabase service + googleapis OAuth2Client |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-04-W0-01 — Migration idempotency | Mitigated: ADD COLUMN IF NOT EXISTS on all three columns |
| T-04-W0-02 — .env.example secrets | Accepted: placeholder strings only; .gitignore covers .env.local |
| T-04-W0-03 — supabase db push admin token | Mitigated: migration only adds columns, no DROP or data mutations |

---

## Known Stubs

All four test files are intentional stubs — they represent the TDD RED phase for Phase 4 implementation. Each will be replaced by passing tests in Plans 02-05:

| File | Plan that resolves | Reason stub is intentional |
|------|--------------------|---------------------------|
| tests/lib/scheduling.test.ts | Plan 02 (slot computation) | `@/lib/scheduling/slots` module doesn't exist yet |
| tests/lib/booking.test.ts | Plan 04 (booking + calendar) | `createAppointment` function doesn't exist yet |
| tests/lib/leads.test.ts | Plan 03 (classify + leads) | `createLead` function doesn't exist yet |
| tests/lib/oauth.test.ts | Plan 02 (OAuth flow) | `getCalendarClient` function doesn't exist yet |

---

## Self-Check

Checking created files exist and commits are recorded:

- supabase/migrations/20260508000008_phase4_scheduling.sql: FOUND
- tests/lib/scheduling.test.ts: FOUND
- tests/lib/booking.test.ts: FOUND
- tests/lib/leads.test.ts: FOUND
- tests/lib/oauth.test.ts: FOUND
- Commit 91cb735: googleapis install + .env.example
- Commit c83d9f9: migration SQL
- Commit 545889b: Wave-0 test stubs

## Self-Check: PASSED
