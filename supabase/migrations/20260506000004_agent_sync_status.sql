-- 20260506000004_agent_sync_status.sql
-- Phase 2: Provisioning — adds agent_sync_status and retell_llm_id to contractors;
-- removes Haitian Creole ('ht') from supported_languages CHECK, emergency_keywords DEFAULT,
-- and calls.language CHECK.
-- D-01: HC removed from product scope entirely.
-- D-12: agent_sync_status tracks Retell sync state; shown as banner in Phase 6 portal.
-- retell_llm_id: needed for PATCH /update-retell-llm/{llm_id} on settings changes (Phase 6).

-- 1. Add new columns to contractors
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS agent_sync_status TEXT
    CHECK (agent_sync_status IS NULL OR agent_sync_status IN ('synced', 'failed', 'pending')),
  ADD COLUMN IF NOT EXISTS retell_llm_id TEXT;

-- 2. Data migration: remove 'ht' from existing supported_languages arrays
UPDATE contractor_settings
  SET supported_languages = array_remove(supported_languages, 'ht')
  WHERE 'ht' = ANY(supported_languages);

-- 3. Fallback: if array is now empty, default to ['en']
UPDATE contractor_settings
  SET supported_languages = ARRAY['en']::TEXT[]
  WHERE array_length(supported_languages, 1) = 0 OR supported_languages IS NULL;

-- 4. Remove 'ht' key from existing emergency_keywords JSONB rows
UPDATE contractor_settings
  SET emergency_keywords = emergency_keywords - 'ht'
  WHERE emergency_keywords ? 'ht';

-- 5. Drop + replace supported_languages CHECK constraint (removes 'ht')
ALTER TABLE contractor_settings
  DROP CONSTRAINT contractor_settings_supported_languages_valid;

ALTER TABLE contractor_settings
  ADD CONSTRAINT contractor_settings_supported_languages_valid
    CHECK (
      supported_languages <@ ARRAY['en','es']::TEXT[]
      AND array_length(supported_languages, 1) >= 1
    );

COMMENT ON CONSTRAINT contractor_settings_supported_languages_valid
  ON contractor_settings
  IS 'D-01 Phase 2: supported_languages must be a non-empty subset of {en, es} — HC removed from product scope';

-- 6. Update emergency_keywords DEFAULT to remove 'ht' key going forward
ALTER TABLE contractor_settings
  ALTER COLUMN emergency_keywords
  SET DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"]
  }'::JSONB;

-- 7. Drop + replace calls.language CHECK constraint (removes 'ht')
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_language_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_language_check
    CHECK (language IS NULL OR language IN ('en', 'es'));
