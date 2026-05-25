# Phase 1 Migration Log

**Migrations applied:** 2026-05-04
**Supabase project:** sbkfhwybkwmbevcfzwdv (voiceDesk Project, East US - North Virginia)
**CLI version:** 2.98.1

| Migration | Status | Notes |
|-----------|--------|-------|
| 20260504000001_initial_schema.sql | applied | 9 tables created, RLS enabled |
| 20260504000002_rls_policies.sql | applied | 33 policies created |
| 20260504000003_contractor_defaults.sql | applied | Defaults re-affirmed; constraint comments added |

## Verification

- All 9 tables return HTTP 200 on PostgREST select-with-limit-0 (contractors, contractor_settings, calls, leads, appointments, calendar_credentials, webhook_events, notification_log, notification_settings)
- Anon role returns [] on contractors (RLS works — no rows exposed to unauthenticated callers)
- webhook_events unique constraint test PASSED via vitest (1/1 test green)

## Push Output (verbatim)

```
Initialising login role...
Connecting to remote database...
Applying migration 20260504000001_initial_schema.sql...
Applying migration 20260504000002_rls_policies.sql...
Applying migration 20260504000003_contractor_defaults.sql...
Finished supabase db push.
```
