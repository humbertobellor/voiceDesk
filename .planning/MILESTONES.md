# Milestones

## 1.1 Notifications & UI Brand (Shipped: 2026-06-01)

**Phases completed:** 5 phases, 20 plans, 17 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- One-liner:
- Three typed React Email JSX templates (lead, emergency, payment failure) with server-only enforcement, EMERGENCY/PAYMENT FAILED styling, and 4/4 TDD tests GREEN.
- One-liner:
- One-liner:
- @radix-ui/react-popover installed and 10 RED TDD stubs scaffolded across 3 test files to unblock Plans 14-02 and 14-03
- computeBellNotification() exported and GREEN (5/5), write-bell-notification Inngest step added with hasValidIntent guard restructure — bell rows now written unconditionally for lead/emergency/info calls
- PATCH /api/notifications/mark-all-read implemented GREEN (3/3 tests); notification-settings Zod schema extended with email_address and notify_email_enabled for EMAIL-01
- useNotifications/useUnreadCount/useMarkAllRead hooks + useNotificationsSubscription + NotificationBell component with Radix Popover, badge, colored feed rows, and mark-all-read
- `src/lib/notifications/telegram.ts`
- globals.css
- Playwright visual baseline captured for 5 key pages at pre-sweep state (hardcoded hex still in components), with ESM-compatible capture script committed to scripts/
- 26 token replacements across 8 shared components (auth forms, notification bell/settings, nav sidebar/tabs) — zero hardcoded hex values remain; reusable sweep script written
- Hex sweep applied to 8 auth and dashboard auxiliary files — zero [# patterns remain
- 1. [Rule 2 - Mapping Extension] Mapped unmapped hex colors not in 26-entry table
- Task 1: Hex audit + D-16 review pass + build verification

---
