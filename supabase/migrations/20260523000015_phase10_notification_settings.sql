-- 20260523000015_phase10_notification_settings.sql
-- Phase 10: Notification Settings Form — adds 3 boolean channel-enable columns to notification_settings.
-- D-02: Explicit opt-in/opt-out model per channel:
--   SMS default TRUE  → opt-out model (existing contractors keep notifications unless they disable)
--   WhatsApp default FALSE → opt-in model (no WA messages until contractor explicitly enables)
--   Telegram default FALSE → opt-in model (no Telegram messages until contractor explicitly enables)
-- RLS: existing notification_settings policies in 20260504000002_rls_policies.sql cover all four
--   operations (SELECT/INSERT/UPDATE/DELETE) by contractor_id.
--   New columns are automatically covered by existing policies — no new policy changes needed.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_sms_enabled IS
  'D-02: Phase 10 gate for SMS dispatch. Default TRUE (opt-out model) — existing contractors keep SMS unless they explicitly disable it. computeChannels() checks this flag alongside sms_number != null.';

COMMENT ON COLUMN notification_settings.notify_whatsapp_enabled IS
  'D-02: Phase 10 gate for WhatsApp dispatch. Default FALSE (opt-in model) — contractors must explicitly enable WhatsApp notifications. computeChannels() checks this flag alongside whatsapp_number != null.';

COMMENT ON COLUMN notification_settings.notify_telegram_enabled IS
  'D-02: Phase 10 gate for Telegram dispatch. Default FALSE (opt-in model) — contractors must explicitly enable Telegram notifications. computeChannels() checks this flag alongside telegram_chat_id != null.';
