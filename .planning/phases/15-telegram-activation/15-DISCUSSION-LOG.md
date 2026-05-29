# Phase 15: Telegram Activation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 15-telegram-activation
**Areas discussed:** Card location, Webhook URL source, Card order

---

## Card Location

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone card in page.tsx | New TelegramWebhookCard client component mounted in Server Component; clean separation of platform-admin vs contractor-settings | |
| New section inside NotificationSettingsForm | Add card to existing form component; simpler but mixes platform-admin action with per-contractor toggles | ✓ |

**User's choice:** New section inside NotificationSettingsForm
**Notes:** Simpler implementation — one client component. Acknowledged the platform/contractor mixing but preferred the reduced component count.

---

## Webhook URL Source

| Option | Description | Selected |
|--------|-------------|----------|
| New TELEGRAM_WEBHOOK_URL env var | Explicit env var; matches project pattern; simple to change per environment | ✓ |
| Auto-derive from NEXT_PUBLIC_APP_URL | Construct URL from existing env var; NEXT_PUBLIC_APP_URL doesn't exist yet in this project | |
| Auto-derive from VERCEL_URL | Vercel auto-injected var; preview-branch-specific, not ideal for permanent webhook registration | |

**User's choice:** New TELEGRAM_WEBHOOK_URL env var
**Notes:** No additional context provided — straightforward agreement with recommended option.

---

## Card Order

| Option | Description | Selected |
|--------|-------------|----------|
| Top — before Email card | First visible; signals platform setup before contractor config | |
| After the Telegram per-contractor card | Groups both Telegram cards together; topically cohesive | ✓ |

**User's choice:** After the Telegram per-contractor card
**Notes:** User preferred topical grouping — both Telegram cards adjacent.

---

## Claude's Discretion

- Icon choice for the webhook card (Bot or Send from lucide-react)
- Copy for registered vs "Not registered" states
- Whether webhook URL is shown truncated or full
- Error message copy for missing env var vs Telegram API failure

## Deferred Ideas

None — discussion stayed within phase scope.
