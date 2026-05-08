// src/lib/classification/emergency-keywords.ts
// EMRG-02: Hard-coded emergency triggers that CANNOT be overridden by contractor configuration.
// Checked BEFORE any LLM call in the classification pipeline.
// D-06: If matched, intent='emergency' is final — LLM cannot override.
// Gas smell and CO alarm are non-configurable by design — safety requirement.
import 'server-only'

export const HARD_EMERGENCY_KEYWORDS: Record<string, readonly string[]> = {
  en: [
    'gas smell',
    'gas leak',
    'co alarm',
    'carbon monoxide',
    'co detector',
    'carbon monoxide alarm',
  ],
  es: [
    'olor a gas',
    'fuga de gas',
    'alarma de co',
    'monóxido de carbono',
    'detector de co',
    'alarma de monóxido',
  ],
} as const

/**
 * Returns true if the transcript contains any hard-coded emergency keyword (EN or ES).
 * Case-insensitive. These keywords cannot be disabled by contractor configuration (EMRG-02).
 */
export function hasHardEmergencyKeyword(transcriptText: string): boolean {
  const lower = transcriptText.toLowerCase()
  return Object.values(HARD_EMERGENCY_KEYWORDS).flat().some(kw => lower.includes(kw))
}
