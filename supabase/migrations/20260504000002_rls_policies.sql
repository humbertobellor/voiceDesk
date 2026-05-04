-- 20260504000002_rls_policies.sql
-- All RLS policies for Phase 1 schema.
-- Source: .planning/phases/01-foundation/01-RESEARCH.md (RLS Policy Patterns)
-- Pattern A: tables with direct user_id (contractors only)
-- Pattern B: tables with contractor_id FK (7 tables)
-- Pattern C: webhook_events (deny-all to authenticated/anon; service role bypasses)

-- =========================================================================
-- Pattern A: contractors (direct user_id)
-- =========================================================================
CREATE POLICY "contractors_select_own"
  ON contractors FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_insert_own"
  ON contractors FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_update_own"
  ON contractors FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_delete_own"
  ON contractors FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =========================================================================
-- Pattern B: contractor_settings
-- =========================================================================
CREATE POLICY "contractor_settings_select_own"
  ON contractor_settings FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "contractor_settings_insert_own"
  ON contractor_settings FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "contractor_settings_update_own"
  ON contractor_settings FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "contractor_settings_delete_own"
  ON contractor_settings FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: calls
-- =========================================================================
CREATE POLICY "calls_select_own"
  ON calls FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calls_insert_own"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calls_update_own"
  ON calls FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calls_delete_own"
  ON calls FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: leads
-- =========================================================================
CREATE POLICY "leads_select_own"
  ON leads FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "leads_insert_own"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "leads_update_own"
  ON leads FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "leads_delete_own"
  ON leads FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: appointments
-- =========================================================================
CREATE POLICY "appointments_select_own"
  ON appointments FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "appointments_insert_own"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "appointments_update_own"
  ON appointments FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "appointments_delete_own"
  ON appointments FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: calendar_credentials
-- =========================================================================
CREATE POLICY "calendar_credentials_select_own"
  ON calendar_credentials FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calendar_credentials_insert_own"
  ON calendar_credentials FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calendar_credentials_update_own"
  ON calendar_credentials FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "calendar_credentials_delete_own"
  ON calendar_credentials FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: notification_log
-- =========================================================================
CREATE POLICY "notification_log_select_own"
  ON notification_log FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_log_insert_own"
  ON notification_log FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_log_update_own"
  ON notification_log FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_log_delete_own"
  ON notification_log FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern B: notification_settings
-- =========================================================================
CREATE POLICY "notification_settings_select_own"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_settings_insert_own"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_settings_update_own"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notification_settings_delete_own"
  ON notification_settings FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- =========================================================================
-- Pattern C: webhook_events (service role only — deny all authenticated/anon access)
-- =========================================================================
CREATE POLICY "webhook_events_deny_all"
  ON webhook_events FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS automatically; webhook handlers in Phase 3 use service role client.
