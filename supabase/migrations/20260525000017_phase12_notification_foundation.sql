-- 20260525000017_phase12_notification_foundation.sql
-- Phase 12: Notification Foundation — app_notifications table + notification_settings email columns + notification_log channel extension
-- D-01: Full bell-ready schema defined here; Phase 14 writes zero migrations, just the React UI.
-- D-02: Column set: id, contractor_id, event_type, title, body, is_read, read_at, created_at
-- D-03: event_type constrained via CHECK (not Postgres enum) — 4 values: lead, emergency, payment_failure, system
-- D-04: RLS uses contractor subquery pattern: (SELECT id FROM contractors WHERE user_id = auth.uid())
-- D-05: ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications — CRITICAL for Phase 14 Realtime subscriptions

-- =========================================================================
-- 1. Create app_notifications table (bell-ready schema — D-01, D-02, D-03)
-- =========================================================================
CREATE TABLE app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('lead', 'emergency', 'payment_failure', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 2. Enable RLS on app_notifications
-- =========================================================================
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 3. RLS policies for app_notifications — contractor subquery pattern (D-04)
--    Prevents cross-tenant access by checking user_id via the contractors table.
--    Pattern source: supabase/migrations/20260504000002_rls_policies.sql lines 35-54.
-- =========================================================================
CREATE POLICY "app_notifications_select_own"
  ON app_notifications FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_insert_own"
  ON app_notifications FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_update_own"
  ON app_notifications FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_delete_own"
  ON app_notifications FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- 4. Register app_notifications with Supabase Realtime (D-05 — CRITICAL)
--    Without this, Supabase Realtime does not fire events on INSERT.
--    Phase 14 NotificationBell subscribes to these events for live badge updates.
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;

-- =========================================================================
-- 5. Index for Phase 14 queries (ORDER BY created_at DESC LIMIT 50)
-- =========================================================================
CREATE INDEX idx_app_notifications_contractor_id_created_at
  ON app_notifications(contractor_id, created_at DESC);

-- =========================================================================
-- 6. Add three new columns to notification_settings (D-06)
--    Existing RLS policies in 20260504000002_rls_policies.sql automatically
--    cover all new columns — no new policy changes needed.
-- =========================================================================
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_email_enabled IS
  'D-06: Email opt-in flag. Default FALSE (opt-in model) — no email until contractor explicitly enables. Phase 14 UI toggles this flag. Gate rule (D-07): email_address IS NOT NULL AND notify_email_enabled = TRUE — both conditions required.';

COMMENT ON COLUMN notification_settings.email_address IS
  'D-06: Contractor-supplied send-to email address. Nullable — email gates on BOTH email_address IS NOT NULL AND notify_email_enabled = TRUE (D-07). Phase 13 shouldSendEmail() checks both conditions before calling sendEmail().';

COMMENT ON COLUMN notification_settings.notify_on_payment_failure IS
  'D-06: Gating flag for payment failure emails (Phase 13). Phase 7 payment failure Inngest function checks this flag before calling sendEmail(). Default FALSE — opt-in model.';

-- =========================================================================
-- 7. Extend notification_log channel CHECK constraint to include 'email'
--    (Pitfall 5 from 12-RESEARCH.md — Phase 13 inserts rows with channel='email')
-- =========================================================================
ALTER TABLE notification_log
  DROP CONSTRAINT notification_log_channel_check,
  ADD CONSTRAINT notification_log_channel_check CHECK (channel IN ('sms', 'whatsapp', 'telegram', 'email'));
