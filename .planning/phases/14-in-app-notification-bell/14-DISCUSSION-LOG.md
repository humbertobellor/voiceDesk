# Phase 14: In-App Notification Bell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 14-in-app-notification-bell
**Areas discussed:** Bell placement, Inngest write step, Notification feed UX, Email settings integration, Duplicate header fix

---

## Bell Placement

### Desktop

| Option | Description | Selected |
|--------|-------------|----------|
| New top header bar | Fixed header bar across the main content area (right of sidebar) | |
| In the Sidebar header (logo row) | Bell icon in the 64px logo area alongside VoiceDesk wordmark | ✓ |

**User's choice:** Sidebar logo row — avoids adding a new layout element.

---

### Mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Add bell tab to BottomTabBar | Bell as 4th tab alongside Calls, Leads, Settings | ✓ |
| Skip mobile bell for now | Desktop-only in Phase 14 | |

**User's choice:** Add bell tab to BottomTabBar.

---

## Inngest Write Step

### Which events write bell rows

| Option | Description | Selected |
|--------|-------------|----------|
| All calls (lead + emergency + info) | Every call writes a bell row, unconditional | ✓ |
| Payment failure | stripe-payment-failure writes a bell row | |
| Only calls with matching channel-enable flags | Mirrors current SMS/email/Telegram gating | |

**User's choice:** All calls — always-on, not gated on channel flags. Payment failure NOT included.

---

### Notification title for lead calls

| Option | Description | Selected |
|--------|-------------|----------|
| New lead — [service type] | e.g. "New lead — HVAC repair" | ✓ |
| New lead from [phone] | e.g. "New lead from +1 305 555 1234" | |
| You decide | Claude picks defaults | |

**User's choice:** "New lead — [service type]" format.

---

### Write timing / step structure

| Option | Description | Selected |
|--------|-------------|----------|
| New step.run('write-bell-notification') | Independent Inngest step with retry isolation | ✓ |
| Inline before channel dispatch steps | Fire-and-forget insert, no retry isolation | |

**User's choice:** Independent Inngest step.

---

### Info/general inquiry calls

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all calls write a bell row | Including general inquiry / info intent | ✓ |
| No — only lead and emergency | Skip info calls to avoid feed clutter | |

**User's choice:** Yes — all calls. Info calls use `event_type: 'system'` (Phase 12 catch-all).

---

## Notification Feed UX

### Visual differentiation by event type

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded left border | Orange for lead, red for emergency, slate for system | ✓ |
| Icon + label badge | Small icon + pill badge per row | |
| Emergency row only highlighted | Red bg tint for emergency; others look the same | |

**User's choice:** Color-coded left border.

---

### Body text truncation

| Option | Description | Selected |
|--------|-------------|----------|
| 1 line (truncate with ellipsis) | Compact rows | ✓ |
| 2 lines (line-clamp-2) | More context visible | |
| No body in the popover | Title + time only | |

**User's choice:** 1 line, truncate with CSS `truncate` class.

---

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Simple centered message | "No notifications yet" | |
| Icon + message + CTA | Bell icon + hint text | |
| You decide | Claude picks consistent with app style | ✓ |

**User's choice:** Claude decides — minimal dark-themed empty state.

---

## Email Settings Integration

### Section position in form

| Option | Description | Selected |
|--------|-------------|----------|
| Top (first card, before SMS) | Email surfaced prominently | ✓ |
| After Telegram (last card before event toggles) | Preserve existing order | |

**User's choice:** Top — first card, before SMS.

---

### Email section controls

| Option | Description | Selected |
|--------|-------------|----------|
| Address + enable toggle only | Simple: email field + checkbox | ✓ |
| Address + enable + payment failure toggle | Three controls, exposes D-08 Phase 13 gate | |

**User's choice:** Address + enable toggle only. `notify_on_payment_failure` UI deferred.

---

## Duplicate Header Fix

**Screenshot provided showing:** Two identical "Notifications / Configure how and where..." blocks on the settings/notifications page.

**Root cause identified:** Both `settings/notifications/page.tsx` (Server Component) and `NotificationSettingsForm` render the same `<h1>Notifications</h1>` + subtitle + `border-b` block.

**Fix direction:** Remove the header block from `NotificationSettingsForm`. The Server Component is the canonical heading owner. One-line deletion, no behavioral change.

---

## Claude's Discretion

- Empty state in notification popover: minimal centered message, consistent with app's dark style
- Bell badge style: numeric vs dot — Claude picks (likely orange dot or numeric pill)
- Relative time: `formatDistanceToNow` from `date-fns` (already installed)

## Deferred Ideas

- Payment failure bell rows — only call events write bell rows in Phase 14
- `notify_on_payment_failure` UI toggle — DB column exists (Phase 13) but deferred to keep form simple
- Per-notification mark-as-read — only mark-all-read in scope per BELL-03
- Notification click-through to call detail — rows show info but don't navigate
- Browser Web Push notifications — future requirement
- Email digest / daily summary — future requirement
