-- 20260504000003_contractor_defaults.sql
-- Verifies and documents the D-11 emergency keyword defaults and LANG-02 constraint.
-- This migration intentionally re-affirms the DEFAULT values; it is safe to re-run.

-- D-11: Emergency keyword defaults (English/Spanish/Haitian Creole).
-- These match the JSONB default in migration 1 verbatim. Updating them here
-- ensures any future schema-only migration cannot silently drop the multi-language
-- defaults — the executor must update both files together.
ALTER TABLE contractor_settings
  ALTER COLUMN emergency_keywords
  SET DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"],
    "ht": ["sant gaz", "pa gen chàfèt", "tiyo pete", "inondasyon", "pa gen kouran", "alàm CO", "sant brile"]
  }'::JSONB;

-- LANG-02: re-affirm the supported_languages column type and CHECK constraint.
-- (CHECK constraint already exists from migration 1; this is an integrity assertion.)
-- If a future migration drops the constraint, the supported_languages CHECK
-- must be re-added immediately in that same migration.
COMMENT ON CONSTRAINT contractor_settings_supported_languages_valid
  ON contractor_settings
  IS 'LANG-02: supported_languages must be a non-empty subset of {en, es, ht}';

-- D-10: Re-affirm the business_hours default (all 7 days, weekend disabled).
ALTER TABLE contractor_settings
  ALTER COLUMN business_hours
  SET DEFAULT '{
    "monday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "tuesday":   {"open": "08:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "thursday":  {"open": "08:00", "close": "18:00", "enabled": true},
    "friday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "saturday":  {"open": "09:00", "close": "14:00", "enabled": false},
    "sunday":    {"open": "09:00", "close": "14:00", "enabled": false}
  }'::JSONB;
