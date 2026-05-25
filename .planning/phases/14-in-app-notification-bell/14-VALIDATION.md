---
phase: 14
slug: in-app-notification-bell
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-25
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/notifications/bell-formatter.test.ts tests/notifications/mark-all-read.test.ts --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/notifications/bell-formatter.test.ts tests/notifications/mark-all-read.test.ts --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT checklist complete
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TDD: computeBellNotification() | TBD | W0 | BELL-01 | — | N/A | unit | `npx vitest run tests/notifications/bell-formatter.test.ts` | ❌ W0 | ⬜ pending |
| PATCH /api/notifications/mark-all-read | TBD | TBD | BELL-03 | — | 401 without session | unit | `npx vitest run tests/notifications/mark-all-read.test.ts` | ❌ W0 | ⬜ pending |
| write-bell-notification Inngest step | TBD | TBD | BELL-01 | — | contractor_id isolation | integration | `npx vitest run tests/notifications/notify-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| Realtime badge increment | TBD | TBD | BELL-01 | — | N/A | Manual UAT | — | Manual only | ⬜ pending |
| Popover open / feed render | TBD | TBD | BELL-02 | — | N/A | Manual UAT | — | Manual only | ⬜ pending |
| Mark all read — optimistic + persist | TBD | TBD | BELL-03 | — | N/A | Manual UAT | — | Manual only | ⬜ pending |
| Email card above SMS in settings | TBD | TBD | EMAIL-01 | — | N/A | Manual UAT | — | Manual only | ⬜ pending |
| Duplicate h1 removed | TBD | TBD | — | — | N/A | Manual UAT | — | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notifications/bell-formatter.test.ts` — 5 RED unit test stubs for `computeBellNotification()` covering: lead, emergency, info, null, no_action intents
- [ ] `tests/notifications/mark-all-read.test.ts` — 3 RED unit test stubs for PATCH handler: 401 unauthorized, 404 no contractor, 200 success
- [ ] `npm install @radix-ui/react-popover@^1.1.15` — required before any NotificationBell component work

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime badge increment without page refresh | BELL-01 | Requires live Supabase WebSocket connection | Process a test call; confirm badge count increments within 10s without refresh |
| Popover opens and renders feed rows with correct border colors | BELL-02 | Visual / interaction check | Click bell; verify rows show orange (lead), red (emergency), slate (system) left borders |
| Mark all read clears badge optimistically; persists after reload | BELL-03 | Requires live DB + Realtime | Click "Mark all read"; verify badge disappears; reload page; verify still 0 |
| Email card renders above SMS card | EMAIL-01 | Visual layout check | Open Settings → Notifications; confirm Email card is first, above SMS |
| Duplicate Notifications h1 is gone | D-22 | Visual check | Open Settings → Notifications; confirm only one "Notifications" heading appears |
| BottomTabBar Bell tab visible on mobile viewport | BELL-01 | Responsive layout check | Resize to < 640px; confirm 4th Bell tab appears in BottomTabBar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
