# Phase 12: Notification Foundation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Schema infrastructure and email transport layer: `app_notifications` table (bell-ready), three new columns on `notification_settings` (email opt-in), and a unit-tested `sendEmail()` transport function — everything Phases 13, 14, and 15 need before they can start. No UI, no Inngest dispatch logic, no email templates (those are Phase 13).

</domain>

<decisions>
## Implementation Decisions

### app_notifications Table Schema

- **D-01:** Define the **full bell-ready schema in Phase 12** — all columns Phase 14 needs. Phase 14 writes zero migrations, just the React UI. No ALTER TABLE later.
- **D-02:** Column set: `id UUID PK`, `contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE`, `event_type TEXT NOT NULL`, `title TEXT NOT NULL`, `body TEXT NOT NULL`, `is_read BOOLEAN NOT NULL DEFAULT FALSE`, `read_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **D-03:** `event_type` constrained to `CHECK (event_type IN ('lead', 'emergency', 'payment_failure', 'system'))` — 4 values. `'system'` added as a catch-all for future platform/admin notifications.
- **D-04:** RLS using the contractor subquery pattern (locked from STATE.md): `(SELECT id FROM contractors WHERE user_id = auth.uid())` — NOT `auth.uid()` directly.
- **D-05:** `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` must be in this migration — Supabase Realtime events won't fire on inserts without it.

### notification_settings New Columns

- **D-06:** Three columns added to `notification_settings` (locked from ROADMAP.md success criteria):
  - `notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE` — opt-in model (no email until contractor enables)
  - `email_address TEXT` — nullable, contractor-supplied send-to address
  - `notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE` — gating flag for payment failure emails (Phase 13)
- **D-07:** `shouldSendEmail` logic must gate on **both** `email_address IS NOT NULL` AND `notify_email_enabled = TRUE`. Checking only the flag is insufficient.

### sendEmail() Transport Interface

- **D-08:** `sendEmail()` is a **transport-only layer** in Phase 12 — it accepts `{ to: string; subject: string; html: string }` and returns `{ success: boolean; messageId?: string; error?: string }`. It never throws.
- **D-09:** `@react-email/components` and `@react-email/render` are **NOT installed in Phase 12**. Only `resend` is installed here. Phase 13 installs the React Email packages when it builds templates.
- **D-10:** `sendEmail()` never throws — returns `{ success: false, error: message }` on Resend failure. Inngest inspects the result and decides retry behavior. Matches the existing non-throwing pattern in `sendSms`, `sendWhatsApp`.
- **D-11:** `sendEmail()` lives at `src/lib/notifications/email.ts` with `import 'server-only'` at the top — never reaches the browser.

### Resend Package

- **D-12:** Install `resend` (check STATE.md for pinned version — `^6.12.3`). Add `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` to `.env.example`. These env vars are server-only — never `NEXT_PUBLIC_` prefixed.
- **D-13:** Unit tests mock Resend via `vi.mock('resend', ...)` — same pattern as existing Twilio mocks in `tests/notifications/sms.test.ts`. No test API key, no network calls.

### TypeScript Types

- **D-14:** Regenerate `src/types/database.ts` after running the migration. `tsc` must exit 0 across the entire project before phase is complete.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema and Migration Context
- `.planning/ROADMAP.md` §Phase 12 — Full success criteria (5 items) — authoritative scope for this phase
- `.planning/REQUIREMENTS.md` — EMAIL-01, EMAIL-05, BELL-04 are the requirements covered by this phase
- `supabase/migrations/20260504000001_initial_schema.sql` — Original `notification_settings` table definition
- `supabase/migrations/20260523000015_phase10_notification_settings.sql` — Phase 10 channel-enable columns (model for new column style)
- `supabase/migrations/20260504000002_rls_policies.sql` — Existing RLS policies for `notification_settings` (new columns are auto-covered; `app_notifications` needs new policies)

### Existing Notification Patterns
- `src/lib/notifications/sms.ts` — Pattern for non-throwing notification transport functions
- `src/lib/notifications/log.ts` — `writeNotificationLog` / `updateNotificationLog` pattern (D-12 pending-before-send)
- `tests/notifications/sms.test.ts` — `vi.mock('twilio', ...)` pattern to replicate for `vi.mock('resend', ...)`

### State and Locked Decisions
- `.planning/STATE.md` §"Key Decisions Locked (v1.1)" — Resend package versions, shouldSendEmail gating, RLS subquery pattern, Tailwind v4 pattern (all pre-locked)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/notifications/log.ts`: `writeNotificationLog` / `updateNotificationLog` — Phase 13 will call these for email sends; Phase 12 only needs to ensure the `notification_log` table's `channel` enum includes `'email'` (check `src/types/database.ts` for `NotificationChannel` type)
- `supabase/migrations/20260523000015_phase10_notification_settings.sql`: Exact pattern for `ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS ...` with COMMENT ON — replicate for Phase 12 email columns
- `tests/notifications/sms.test.ts`: Full test scaffold for a notification transport function — replicate for `email.test.ts`

### Established Patterns
- All notification libs: `import 'server-only'` at top — enforce in `email.ts`
- Non-throwing return pattern: `sendSms` returns `{sid, status}` and never throws — `sendEmail` must match with `{success, messageId?, error?}`
- RLS contractor subquery: `(SELECT id FROM contractors WHERE user_id = auth.uid())` — used in `contractors` and `notification_settings` tables; replicate exactly for `app_notifications`
- Migration comment header: `-- 20260XXX_phase12_notification_foundation.sql` + phase/decision commentary

### Integration Points
- `notification_log` table: Phase 13 email sends log with `channel: 'email'` — verify `NotificationChannel` union type in `src/types/database.ts` includes `'email'` (or add it in this phase's type regeneration)
- Phase 14's `NotificationBell` component: will query `app_notifications` filtered by `contractor_id` + `ORDER BY created_at DESC LIMIT 50` + subscribe via Supabase Realtime — schema D-02 supports this directly

</code_context>

<specifics>
## Specific Ideas

- `event_type` CHECK constraint (not a Postgres enum type) — easier to extend in future phases without migration complexity
- `read_at` column included even though BELL-03 only requires clearing the badge — useful for analytics and doesn't cost anything to add now
- `'system'` event type included alongside `'lead' | 'emergency' | 'payment_failure'` — catch-all for future admin/platform notifications

</specifics>

<deferred>
## Deferred Ideas

- `@react-email/components` + `@react-email/render` installation — deferred to Phase 13 when templates are built
- React Email JSX template interface for `sendEmail()` — Phase 13 decision; Phase 12 only builds the HTML-string transport
- Per-notification mark-as-read (`read_at` per-row update endpoint) — future requirement, BELL-03 only requires mark-all-read
- Email digest / daily summary — explicitly in REQUIREMENTS.md future list
- Browser push notifications (Web Push API) — future requirement

</deferred>

---

*Phase: 12-Notification Foundation*
*Context gathered: 2026-05-24*
