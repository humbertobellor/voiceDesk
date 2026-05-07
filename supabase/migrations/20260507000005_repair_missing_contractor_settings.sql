-- Repair: insert missing contractor_settings rows for contractors that completed
-- onboarding before the settings row was reliably created.
-- Safe to re-run — ON CONFLICT (contractor_id) DO NOTHING skips existing rows.
-- All inserted rows use DB-level defaults (trade_type='hvac', supported_languages=['en'],
-- emergency_keywords pre-filled, agent_voice='elevenlabs-myra').

DO $$
DECLARE
  repaired_count INT;
BEGIN
  INSERT INTO contractor_settings (contractor_id, business_name)
  SELECT c.id, c.business_name
  FROM contractors c
  WHERE NOT EXISTS (
    SELECT 1 FROM contractor_settings cs WHERE cs.contractor_id = c.id
  )
  ON CONFLICT (contractor_id) DO NOTHING;

  GET DIAGNOSTICS repaired_count = ROW_COUNT;

  IF repaired_count > 0 THEN
    RAISE NOTICE 'repair_missing_contractor_settings: inserted % missing contractor_settings row(s)', repaired_count;
  ELSE
    RAISE NOTICE 'repair_missing_contractor_settings: no missing rows found — nothing to repair';
  END IF;
END $$;
