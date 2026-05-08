// tests/lib/classification.test.ts
// Covers: EMRG-01 (non-hard-coded emergency keywords pass to LLM), EMRG-02 (gas/CO always emergency),
//         CALL-02 (LLM classification returns valid enum), CALL-03 (trade-specific extraction)
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('openai')

import { hasHardEmergencyKeyword } from '@/lib/classification/emergency-keywords'

describe('hasHardEmergencyKeyword (EMRG-02)', () => {
  it('returns true for "gas smell" in English', async () => {
    expect(hasHardEmergencyKeyword('gas smell detected in the house')).toBe(true)
  })

  it('returns true for "co alarm" in English', async () => {
    expect(hasHardEmergencyKeyword('CO alarm going off')).toBe(true)
  })

  it('returns true for "olor a gas" in Spanish', async () => {
    expect(hasHardEmergencyKeyword('olor a gas en la cocina')).toBe(true)
  })

  it('returns true for "alarma de co" in Spanish', async () => {
    expect(hasHardEmergencyKeyword('alarma de co activada')).toBe(true)
  })

  it('returns false for non-hard-coded keyword "no heat" (EMRG-01 — must go to LLM)', async () => {
    expect(hasHardEmergencyKeyword('no heat in the house')).toBe(false)
  })
})

describe('classifyIntent (CALL-02)', () => {
  it('returns valid intent enum value from LLM (lead | emergency | info | no_action)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns no_action with is_short_call=true context (D-13)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns detected_trade alongside intent for multi-trade contractors (D-08)', async () => {
    throw new Error('not yet implemented')
  })
})

describe('extractTradeData (CALL-03)', () => {
  it('returns hvac schema fields for hvac trade type', async () => {
    throw new Error('not yet implemented')
  })

  it('returns plumbing schema fields for plumbing trade type', async () => {
    throw new Error('not yet implemented')
  })

  it('returns electrical schema fields for electrical trade type', async () => {
    throw new Error('not yet implemented')
  })

  it('returns null for no_action intent (D-13)', async () => {
    throw new Error('not yet implemented')
  })
})
