// tests/lib/classification.test.ts
// Covers: EMRG-01 (non-hard-coded emergency keywords pass to LLM), EMRG-02 (gas/CO always emergency),
//         CALL-02 (LLM classification returns valid enum), CALL-03 (trade-specific extraction),
//         D-11 (confirmed_appointment_time + service_address in all four schemas)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// vi.hoisted: variables declared here are available inside vi.mock factory (hoisting-safe).
const { mockParse } = vi.hoisted(() => ({
  mockParse: vi.fn(),
}))

vi.mock('openai', () => {
  // OpenAI default export is a class — mock as a constructor that returns the mock instance.
  class OpenAI {
    chat = { completions: { parse: mockParse } }
    constructor(_opts?: unknown) {}
  }
  return { default: OpenAI }
})

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
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset OPENAI_API_KEY for singleton reuse
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns valid intent enum value from LLM (lead | emergency | info | no_action)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { intent: 'lead', detected_trade: 'hvac', confidence: 'high' },
          },
        },
      ],
    })

    const { classifyIntent } = await import('@/lib/classification/classify-intent')
    const result = await classifyIntent('Customer called about gas smell', false)

    expect(result.intent).toBe('lead')
    expect(['lead', 'emergency', 'info', 'no_action']).toContain(result.intent)
    expect(result.confidence).toBe('high')
    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    )
  })

  it('returns no_action with is_short_call=true context (D-13)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { intent: 'no_action', confidence: 'high' },
          },
        },
      ],
    })

    const { classifyIntent } = await import('@/lib/classification/classify-intent')
    const result = await classifyIntent('Short unintelligible call', true)

    expect(result.intent).toBe('no_action')
    // Verify the system prompt included the short call note
    const callArgs = mockParse.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('under 15 seconds')
  })

  it('returns detected_trade alongside intent for multi-trade contractors (D-08)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { intent: 'emergency', detected_trade: 'electrical', confidence: 'high' },
          },
        },
      ],
    })

    const { classifyIntent } = await import('@/lib/classification/classify-intent')
    const result = await classifyIntent('Outlet sparking', false)

    expect(result.intent).toBe('emergency')
    expect(result.detected_trade).toBe('electrical')
  })
})

describe('extractTradeData (CALL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns hvac schema fields for hvac trade type', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { system_age: '12 years', issue_type: 'cooling', urgency: 'urgent' },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('AC not cooling, system is 12 years old', 'hvac')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ system_age: '12 years', issue_type: 'cooling', urgency: 'urgent' })
    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' })
    )
  })

  it('returns plumbing schema fields for plumbing trade type', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { leak_type: 'active', repair_type: 'pipe replacement', urgency: 'urgent' },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('Active water leak under sink', 'plumbing')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ leak_type: 'active', urgency: 'urgent' })
  })

  it('returns electrical schema fields for electrical trade type', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: { safety_issue: true, repair_type: 'outlet replacement', urgency: 'emergency' },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('Outlet sparking', 'electrical')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ safety_issue: true, urgency: 'emergency' })
  })

  it('returns null for no_action intent (D-13)', async () => {
    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    // Empty transcript → null (no API call waste)
    const result = await extractTradeData('', undefined)

    expect(result).toBeNull()
    expect(mockParse).not.toHaveBeenCalled()
  })
})

// D-11: Phase 4 schema extension — confirmed_appointment_time + service_address in all four schemas
describe('extractTradeData D-11 schema extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('hvac schema includes confirmed_appointment_time when LLM returns it', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: {
              system_age: '5 years',
              issue_type: 'cooling',
              urgency: 'normal',
              confirmed_appointment_time: '2026-05-12T10:00:00',
              service_address: '123 Main St, Miami FL',
            },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('AC service scheduled for Tuesday at 10am at 123 Main St', 'hvac')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      confirmed_appointment_time: '2026-05-12T10:00:00',
      service_address: '123 Main St, Miami FL',
    })
  })

  it('hvac schema returns null for confirmed_appointment_time when no appointment confirmed', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: {
              system_age: null,
              issue_type: 'cooling',
              urgency: 'urgent',
              confirmed_appointment_time: null,
              service_address: null,
            },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('AC not working, need someone ASAP', 'hvac')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ confirmed_appointment_time: null, service_address: null })
  })

  it('plumbing schema includes confirmed_appointment_time and service_address (D-11)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: {
              leak_type: 'slow',
              repair_type: null,
              urgency: 'normal',
              confirmed_appointment_time: '2026-05-14T09:00:00',
              service_address: '456 Oak Ave, Fort Lauderdale',
            },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('Slow leak booked for Thursday 9am', 'plumbing')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      confirmed_appointment_time: '2026-05-14T09:00:00',
      service_address: '456 Oak Ave, Fort Lauderdale',
    })
  })

  it('electrical schema includes confirmed_appointment_time and service_address (D-11)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: {
              safety_issue: false,
              repair_type: 'outlet',
              urgency: 'normal',
              confirmed_appointment_time: '2026-05-15T14:00:00',
              service_address: null,
            },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('Outlet repair booked for Friday 2pm, no address given', 'electrical')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      confirmed_appointment_time: '2026-05-15T14:00:00',
      service_address: null,
    })
  })

  it('general schema includes confirmed_appointment_time and service_address (D-11)', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [
        {
          message: {
            parsed: {
              issue_description: 'general repair',
              urgency: 'normal',
              confirmed_appointment_time: '2026-05-13T11:00:00',
              service_address: '789 Pine Rd, Hialeah FL',
            },
          },
        },
      ],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    const result = await extractTradeData('General repair booked for Wednesday at 11am', undefined)

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      confirmed_appointment_time: '2026-05-13T11:00:00',
      service_address: '789 Pine Rd, Hialeah FL',
    })
  })

  it('buildExtractionPrompt includes ISO format instructions for confirmed_appointment_time (D-11)', async () => {
    // The prompt must instruct the LLM to use YYYY-MM-DDTHH:MM:SS without timezone suffix
    // and to return null when no appointment was confirmed.
    // We verify this by checking what is passed to mockParse.
    mockParse.mockResolvedValueOnce({
      choices: [{ message: { parsed: { issue_description: null, urgency: 'normal', confirmed_appointment_time: null, service_address: null } } }],
    })

    const { extractTradeData } = await import('@/lib/classification/extract-trade')
    await extractTradeData('No appointment scheduled', 'hvac')

    const callArgs = mockParse.mock.calls[0][0]
    const systemPrompt: string = callArgs.messages[0].content
    expect(systemPrompt).toContain('confirmed_appointment_time in ISO format (YYYY-MM-DDTHH:MM:SS) without timezone suffix')
    expect(systemPrompt).toContain('return null for confirmed_appointment_time')
    expect(systemPrompt).toContain('service_address')
  })
})
