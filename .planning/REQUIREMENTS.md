# VoiceDesk v1.1 Requirements

**Milestone:** v1.1 — Notifications & UI Brand
**Defined:** 2026-05-24
**Total:** 14 requirements across 4 categories

---

## Email Notifications

- [x] **EMAIL-01**: Contractor can enter an email address in Notification Settings and enable email alerts (opt-in, disabled by default)
- [x] **EMAIL-02**: Contractor receives an email within 60 seconds of a new lead call, containing caller phone number, service type, and appointment status
- [x] **EMAIL-03**: Contractor receives an email within 60 seconds of an emergency call, with EMERGENCY prefix prominently displayed and caller callback number
- [x] **EMAIL-04**: Contractor receives an email when a Stripe payment fails, with a link to the billing portal to update payment method
- [x] **EMAIL-05**: Email send success and failure are recorded in `notification_log` with `channel: 'email'` — failures are visible and retried by Inngest

## In-App Notification Bell

- [ ] **BELL-01**: A bell icon in the dashboard header displays an unread badge count that updates in real-time (via Supabase Realtime) without a page refresh
- [ ] **BELL-02**: Clicking the bell opens a panel listing the 50 most recent notifications, each showing event type, title, body excerpt, and relative time
- [ ] **BELL-03**: Contractor can mark all notifications as read with one action, clearing the unread badge
- [x] **BELL-04**: Notifications are persisted in the database and remain visible after browser close and reopen

## Telegram Activation

- [x] **TEL-01**: The Notification Settings page shows the current Telegram webhook status — either the registered webhook URL or "Not registered" — fetched on page load
- [x] **TEL-02**: A contractor or admin can activate the platform Telegram webhook from settings with a single button click; the status display updates to show the registered URL on success, or an error message on failure

## Design System

- [ ] **BRAND-01**: All Wolknitive brand color, typography, and spacing tokens are defined as CSS custom properties in `globals.css` and available as Tailwind utility class names
- [ ] **BRAND-02**: No hardcoded hex color values (`[#XXXXXX]` arbitrary Tailwind values) remain in any component file outside `globals.css`
- [ ] **BRAND-03**: All dashboard pages (call log, leads, agent config, settings tabs, account page) and auth pages (login, signup) render using brand tokens consistently
- [ ] **BRAND-04**: `npm run build` exits 0 and the 15/15 v1.0 regression tests pass after the design system sweep

---

## Future Requirements (deferred)

- Per-notification mark-as-read (mark all is sufficient for v1.1)
- Email digest / daily summary
- Browser push notifications (Web Push API)
- "Quiet hours" notification schedule
- Per-contractor Telegram bots (platform bot architecture in v1.x)
- Dark mode toggle (dark palette is fixed theme)
- Landing / marketing page (app UI only for v1.1)
- Email template editor / customization

## Out of Scope

- WhatsApp WABA activation — external Meta approval process, not a code change
- Google OAuth production mode — operational task, not a code change
- Additional notification channels beyond SMS/WA/Telegram/Email
- Outbound notifications (follow-up sequences, reminders) — inbound-only product

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMAIL-01 | Phase 12 | Complete |
| EMAIL-02 | Phase 13 | Complete |
| EMAIL-03 | Phase 13 | Complete |
| EMAIL-04 | Phase 13 | Complete |
| EMAIL-05 | Phase 13 | Complete |
| BELL-01 | Phase 14 | Pending |
| BELL-02 | Phase 14 | Pending |
| BELL-03 | Phase 14 | Pending |
| BELL-04 | Phase 12 | Complete |
| TEL-01 | Phase 15 | Complete |
| TEL-02 | Phase 15 | Complete |
| BRAND-01 | Phase 16 | Pending |
| BRAND-02 | Phase 16 | Pending |
| BRAND-03 | Phase 16 | Pending |
| BRAND-04 | Phase 16 | Pending |
