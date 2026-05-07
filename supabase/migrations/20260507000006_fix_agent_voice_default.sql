-- Fix incorrect agent_voice default: 'elevenlabs-myra' → '11labs-Myra'
-- Retell voice IDs use the '11labs-' prefix (not 'elevenlabs-') and are case-sensitive.
-- Verified against Retell /list-voices API: '11labs-Myra' exists; 'elevenlabs-myra' does not.

ALTER TABLE contractor_settings
  ALTER COLUMN agent_voice SET DEFAULT '11labs-Myra';

-- Fix any existing rows that have the incorrect value.
UPDATE contractor_settings
  SET agent_voice = '11labs-Myra'
  WHERE agent_voice = 'elevenlabs-myra';
