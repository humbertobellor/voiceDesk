# Koolable v1.2 Requirements

**Milestone:** v1.2 — In-App Notifications & Brand Polish  
**Defined:** 2026-06-01  
**Total:** 9 requirements across 2 categories

---

## In-App Notification Bell (deferred from v1.1)

- [ ] **BELL-01**: A bell icon in the dashboard header displays an unread badge count that updates in real-time (via Supabase Realtime) without a page refresh
- [ ] **BELL-02**: Clicking the bell opens a panel listing the 50 most recent notifications, each showing event type, title, body excerpt, and relative time (e.g., "3 minutes ago")
- [ ] **BELL-03**: Contractor can mark all notifications as read with one action, clearing the unread badge; the cleared state persists across browser sessions
- [ ] **BELL-05**: Per-notification mark-as-read action — clicking a mark-as-read button on an individual notification updates its read state immediately; UI reflects unread/read state with visual distinction

**Success Criteria:**
1. Bell icon visible in dashboard header on all pages
2. Unread count updates in real-time without page refresh (Supabase Realtime driven)
3. Bell panel shows up to 50 notifications with proper formatting and relative timestamps
4. Mark-all-read clears all unread flags in `app_notifications.is_read = true`
5. Per-notification mark-as-read PATCH works on individual rows and updates UI immediately
6. Notifications persist in database and survive browser close/reopen
7. Supabase Realtime subscription properly filtered by `contractor_id` (IDOR guard)
8. All 15 v1.0 regression tests still pass (no regressions)

---

## Logo Integration (new in v1.2)

- [ ] **LOGO-01**: Company logo appears on all authentication pages (login, signup) — positioned consistently with brand guidelines
- [ ] **LOGO-02**: Company logo appears in the dashboard header (next to or in place of text branding) on all dashboard pages
- [ ] **LOGO-03**: Company logo appears in the Sidebar — positioned for visual hierarchy and accessibility
- [ ] **LOGO-04**: Company logo is included in email notification templates (new lead, emergency, payment failure) — rendered via React Email
- [ ] **LOGO-05**: Logo sizing, placement, and contrast all pass accessibility standards (WCAG AA) and are responsive across mobile and desktop viewports

**Success Criteria:**
1. Logo file(s) in `public/` directory with appropriate formats (SVG preferred for auth pages, PNG/SVG for Sidebar/header)
2. Logo appears on `/auth/login` and `/auth/signup` pages in consistent position
3. Logo appears in dashboard header (`components/dashboard/Sidebar` or `Header`) visible on all dashboard routes
4. Logo appears in Sidebar (top or bottom section, per brand spec)
5. Logo included in React Email templates: `LeadNotificationEmail`, `EmergencyNotificationEmail`, `PaymentFailureEmail`
6. Logo contrast ratio ≥4.5:1 against background (WCAG AA for normal text)
7. Logo responsive — scales appropriately on mobile (viewport ≤768px) and desktop (≥1024px)
8. No console warnings/errors related to image loading or missing alt text
9. Build succeeds with `npm run build` — no dead imports or unused assets

---

## Dependencies & Notes

**BELL implementation depends on:**
- v1.1 schema: `app_notifications` table with RLS, `notification_settings`, `notification_log`
- v1.1 Inngest integration: notification write steps already exist
- React Query and Supabase Realtime hooks already installed

**LOGO implementation has:**
- No new package dependencies required
- Asset design (logo files) assumed to be provided by stakeholder
- Email template rendering via existing `@react-email/components`

**Integration points:**
- BELL and LOGO are independent — can be executed in parallel phases
- No database migrations required for BELL (schema exists)
- No migrations required for LOGO (assets only)

---

## Out of Scope (v1.2)

- Dark mode toggle (dark palette is fixed theme in v1.x)
- Email digest / daily summary notifications
- Browser push notifications (Web Push API)
- "Quiet hours" notification scheduling
- Per-contractor Telegram bots (platform bot architecture in v1.x)
- Landing / marketing page (app UI only for v1.x)
- Email template editor / customization UI
- Logo animation or variants (single static logo)
- Notification categories or grouping
- Notification deletion

---

## Future Requirements (deferred to v1.3+)

- Dark mode toggle with theme persistence
- Per-notification categories / filtering UI
- Notification digest / summary email
- Browser push notifications (Web Push API)
- "Quiet hours" notification schedule
- Per-contractor Telegram bots
- Landing / marketing page
- Email template customization UI
