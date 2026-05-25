# Phase 12: Notification Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 12-notification-foundation
**Areas discussed:** app_notifications schema scope, sendEmail() interface

---

## app_notifications Schema Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema now | Define all Phase-14-needed columns now: contractor_id, event_type, title, body, is_read, read_at, created_at. Phase 14 writes zero migrations. | ✓ |
| Minimal now, Phase 14 adds columns | Only contractor_id + is_read + created_at in Phase 12; Phase 14 adds event_type, title, body via ALTER TABLE. | |

**User's choice:** Full schema now
**Notes:** No additional notes.

---

## event_type Values

| Option | Description | Selected |
|--------|-------------|----------|
| 'lead' \| 'emergency' \| 'payment_failure' | 3 values matching v1.1 notification triggers exactly. | ✓ |
| Add 'system' as 4th catch-all | Future admin/platform messages. | ✓ |

**User's choice:** Both — all 4 values: `'lead' | 'emergency' | 'payment_failure' | 'system'`
**Notes:** `'system'` included as a forward-looking catch-all without any current consumers.

---

## sendEmail() Interface

| Option | Description | Selected |
|--------|-------------|----------|
| Transport layer — `{ to, subject, html }` | Accepts plain HTML string. Only `resend` installed in Phase 12. Phase 13 installs @react-email/* and renders templates before calling. | ✓ |
| React-first — `{ to, subject, react }` | Accepts ReactElement; email.ts renders JSX internally. All 3 packages in Phase 12. | |

**User's choice:** Transport layer — `{ to, subject, html: string }`
**Notes:** Clean separation: Phase 12 = transport, Phase 13 = templates.

---

## sendEmail() Return Type

| Option | Description | Selected |
|--------|-------------|----------|
| `{ success: boolean; messageId?: string; error?: string }` | Never throws, typed result, Inngest inspects to decide retry. Matches existing sendSms/sendWhatsApp pattern. | ✓ |
| Throw on failure | Simpler, Inngest auto-catches. Loses structured messageId. | |

**User's choice:** `{ success: boolean; messageId?: string; error?: string }`
**Notes:** Consistency with existing non-throwing notification lib pattern was the deciding factor.

---

## Claude's Discretion

- `read_at TIMESTAMPTZ` column included in `app_notifications` even though BELL-03 only requires mark-all-read — useful for analytics, zero cost to add now
- `CHECK` constraint used for `event_type` (not a Postgres enum type) — easier to extend without migration complexity

## Deferred Ideas

- `@react-email/components` + `@react-email/render` — deferred to Phase 13
- React Email JSX template interface — Phase 13 decision
- Per-notification mark-as-read endpoint — future requirement
- Email digest / daily summary — REQUIREMENTS.md future list
- Browser push notifications — future requirement
