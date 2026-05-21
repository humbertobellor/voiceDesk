-- Fix invalid agent_voice values that were set by the old VoiceForm
-- which used fake IDs ('sarah', 'james', 'emily', 'michael', 'sophia', 'daniel').
-- Reset them to the valid default '11labs-Myra'.
UPDATE contractor_settings
SET agent_voice = '11labs-Myra'
WHERE agent_voice IN ('sarah', 'james', 'emily', 'michael', 'sophia', 'daniel');
