# Phase 15: Telegram Activation - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Telegram Webhook Activation" card to `NotificationSettingsForm` that shows the current platform-level webhook registration status on page load (via grammy `bot.api.getWebhookInfo()`) and lets any authenticated contractor activate it with one click. The card is inserted between the existing per-contractor Telegram link card (Section 3) and the Event type toggles (Section 4). No schema migrations, no new packages.

The two TEL requirements are:
- **TEL-01:** Webhook status visible on load — registered URL or "Not registered"
- **TEL-02:** One-click activation via server action; status updates without page reload; inline error on failure

</domain>

<decisions>
## Implementation Decisions

### Card Placement

- **D-01:** The webhook status card is a **new section inside `NotificationSettingsForm`** — not a standalone component. It reuses the existing `cardClass` CSS (`bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4`) for visual consistency.
- **D-02:** Position: **after Section 3 (per-contractor Telegram link card)** and before Section 4 (Event type toggles). The two Telegram-related cards are grouped together: first the per-contractor `/start` link, then the platform webhook status. Label it distinctly (e.g., "Telegram Bot Webhook") to distinguish it from the per-contractor connection card above.

### Server Action

- **D-03:** A new Next.js server action `activateTelegramWebhook()` in a new file (e.g., `src/app/(dashboard)/settings/notifications/actions.ts`). It calls `bot.api.setWebhook(webhookUrl, { secret_token: TELEGRAM_WEBHOOK_SECRET })` using the `getBot()` singleton from `src/lib/notifications/telegram.ts`.
- **D-04:** The webhook URL is sourced from a **new `TELEGRAM_WEBHOOK_URL` env var** — explicit, matches the project's pattern of env vars for external service URLs. Value: full URL, e.g., `https://voicedesk.app/api/webhooks/telegram`. Must be added to `.env.example`.
- **D-05:** The server action also calls `bot.api.getWebhookInfo()` after a successful `setWebhook` and returns the updated info to the client so the status display updates immediately.
- **D-06:** On failure, the server action returns an error message string. No throwing — client handles gracefully.

### Status Fetch on Load

- **D-07:** `notifications/page.tsx` (Server Component) calls `bot.api.getWebhookInfo()` on load and passes `initialWebhookInfo` as a prop to the new card section inside `NotificationSettingsForm`. This avoids a client-side fetch on mount and keeps the pattern consistent with how `initialSettings` is already passed.
- **D-08:** If `TELEGRAM_BOT_TOKEN` is missing or `getWebhookInfo()` throws, the Server Component catches and passes `null` — the card renders a "Status unavailable" fallback rather than crashing.

### Client State

- **D-09:** The card tracks `webhookInfo` in local React state (initialized from `initialWebhookInfo` prop). After a successful server action call, update state with the returned info. No React Query needed — this is a one-shot action with an immediate response.
- **D-10:** The activate button shows a loading spinner while the action is in-flight. On success: state updates to show the registered URL. On failure: inline error below the button. Pattern mirrors the existing `handleUnlinkTelegram` handler in the same component.

### Claude's Discretion

- Exact card heading and icon choice (suggest `Bot` or `Send` from lucide-react, already imported)
- Exact copy for "Not registered" vs registered states
- Whether to show webhook URL truncated or full
- Error message copy for missing `TELEGRAM_WEBHOOK_URL` env var vs Telegram API failure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Telegram Code
- `src/lib/notifications/telegram.ts` — `getBot()` singleton; reuse for server action and page-load fetch
- `src/app/api/webhooks/telegram/route.ts` — webhook endpoint this action registers; shows `TELEGRAM_WEBHOOK_SECRET` usage pattern
- `src/components/notification/NotificationSettingsForm.tsx` — full client component to modify; add new card between Section 3 and Section 4
- `src/app/(dashboard)/settings/notifications/page.tsx` — Server Component to extend with `getWebhookInfo()` call

### Requirements
- `.planning/REQUIREMENTS.md` §TEL-01, TEL-02 — success criteria for this phase
- `.planning/ROADMAP.md` §Phase 15 — success criteria (authoritative spec): 4 concrete pass/fail conditions

### Prior Phase Decisions
- `.planning/STATE.md` §Accumulated Context — locked decisions: grammy v1.x (do NOT upgrade), `TELEGRAM_BOT_TOKEN` env var name, platform-level single bot

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getBot()` in `src/lib/notifications/telegram.ts` — call `getBot().api.setWebhook()` and `getBot().api.getWebhookInfo()` directly; no new Bot instantiation
- `cardClass` CSS string in `NotificationSettingsForm` — reuse for new card's outer div
- `Loader2` from lucide-react (already imported) — reuse for button loading state
- `handleUnlinkTelegram` handler pattern — mirrors the pattern for the activate button (local loading + error state)

### Established Patterns
- Server Component → Client Component prop threading: `notifications/page.tsx` already passes `initialSettings`; extend with `initialWebhookInfo`
- Inline error display: `telegramError` + `setTelegramError` pattern already used in the Telegram section — follow same pattern for webhook activation errors
- `'use server'` action files: see `src/app/(dashboard)/` for existing server action files

### Integration Points
- `NotificationSettingsForm` props interface — extend with `initialWebhookInfo: WebhookInfo | null`
- `notifications/page.tsx` — add `getBot().api.getWebhookInfo()` call in the Server Component, pass result as prop
- `.env.example` — add `TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram`

</code_context>

<specifics>
## Specific Ideas

- Card order: per-contractor Telegram link card → **Telegram Bot Webhook card (new)** → Event type toggles. The two Telegram cards are adjacent.
- The webhook activation is not gated — any authenticated contractor who opens Notification Settings can activate. This is intentional per TEL-02 ("contractor or admin").
- The `TELEGRAM_WEBHOOK_URL` env var must be a full `https://` URL. The server action should validate this and return a clear error if it's missing rather than calling Telegram with an invalid URL.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-telegram-activation*
*Context gathered: 2026-05-29*
