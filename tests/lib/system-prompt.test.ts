// tests/lib/system-prompt.test.ts
// Unit tests for system prompt builder — LANG-01 runtime language branching.
// D-04 through D-07: persona, greeting, after-hours, out-of-scope behavior.
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import type { ContractorSettings } from '@/types/database'

const baseSettings: ContractorSettings = {
  id: 'cs-test',
  contractor_id: 'c-test',
  business_name: 'Miami HVAC Pro',
  trade_type: 'hvac',
  service_area: 'Miami-Dade County',
  supported_languages: ['en'],
  business_hours: {} as ContractorSettings['business_hours'],
  appointment_duration_minutes: 120,
  emergency_keywords: { en: ['gas smell', 'no heat'], es: ['olor a gas'] },
  after_hours_message: 'We are currently closed.',
  agent_voice: 'elevenlabs-myra',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('buildSystemPrompt', () => {
  it('includes the business name', () => {
    const prompt = buildSystemPrompt(baseSettings)
    expect(prompt).toContain('Miami HVAC Pro')
  })

  it('includes the after-hours message', () => {
    const prompt = buildSystemPrompt(baseSettings)
    expect(prompt).toContain('We are currently closed.')
  })

  it('includes at least one English emergency keyword', () => {
    const prompt = buildSystemPrompt(baseSettings)
    expect(prompt).toContain('gas smell')
  })

  it('does NOT include Spanish greeting when only English', () => {
    const prompt = buildSystemPrompt({ ...baseSettings, supported_languages: ['en'] })
    expect(prompt).not.toContain('Para español')
  })

  it('includes Spanish greeting when Spanish is enabled', () => {
    const prompt = buildSystemPrompt({ ...baseSettings, supported_languages: ['es'] })
    expect(prompt).toContain('Para español, oprima dos')
  })
})

describe('buildBeginMessage', () => {
  it('returns English-only greeting when only English supported', () => {
    const msg = buildBeginMessage({ ...baseSettings, supported_languages: ['en'] })
    expect(msg).toContain('Miami HVAC Pro')
    expect(msg).not.toContain('Para español')
  })

  it('returns bilingual greeting when Spanish is supported', () => {
    const msg = buildBeginMessage({ ...baseSettings, supported_languages: ['en', 'es'] })
    expect(msg).toContain('Para español, oprima dos')
  })
})
