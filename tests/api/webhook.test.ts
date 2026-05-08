// tests/api/webhook.test.ts
// Covers: CALL-01 (webhook returns 200 immediately), D-02 (401 on forged signature), D-05 (idempotency upsert)
// Security: T-03-01 (forged webhook → 401), T-03-02 (contractor_id never from payload)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({
  after: vi.fn((fn) => fn()),
}))
vi.mock('retell-sdk', () => ({
  verify: vi.fn(),
}))

// Mutable mock state for Supabase chains — reset per test
const mockMaybeSingleContractor = vi.fn()
const mockMaybeSingleCallRow = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'contractors') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingleContractor,
            })),
          })),
        }
      }
      // calls table
      return {
        upsert: mockUpsert,
      }
    }),
  })),
}))

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))

// Imports after mocks
import { verify } from 'retell-sdk'
import { processCallEnded } from '@/app/api/webhooks/retell/handlers'

const mockVerify = vi.mocked(verify)

// Helper: build a minimal RetellCallPayload
function makeCall(overrides = {}) {
  return {
    call_id: 'call-123',
    agent_id: 'agent-abc',
    from_number: '+15555550100',
    to_number: '+15555550200',
    direction: 'inbound' as const,
    call_status: 'ended',
    ...overrides,
  }
}

// Helper: make a Request object for the POST handler
function makeRequest(body: object, signature = 'valid-sig') {
  const rawBody = JSON.stringify(body)
  return new Request('http://localhost/api/webhooks/retell', {
    method: 'POST',
    body: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-retell-signature': signature,
    },
  })
}

describe('POST /api/webhooks/retell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RETELL_API_KEY = 'test-retell-key'

    // Default: contractor not found (safe default for upsert tests)
    mockMaybeSingleContractor.mockResolvedValue({ data: null, error: null })
    // Default: upsert returns no error, with select chain
    mockUpsert.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: mockMaybeSingleCallRow,
      })),
      error: null,
    })
    mockMaybeSingleCallRow.mockResolvedValue({ data: null, error: null })
  })

  it('returns 200 for valid call_ended event', async () => {
    mockVerify.mockResolvedValue(true)

    const { POST } = await import('@/app/api/webhooks/retell/route')
    const req = makeRequest({ event: 'call_ended', call: makeCall() })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('OK')
  })

  it('returns 401 for invalid signature (T-03-01)', async () => {
    mockVerify.mockResolvedValue(false)

    const { POST } = await import('@/app/api/webhooks/retell/route')
    const req = makeRequest({ event: 'call_ended', call: makeCall() }, 'bad-sig')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toBe('Unauthorized')
  })

  it('creates exactly one calls row for duplicate call_ended events (D-05)', async () => {
    // Test that processCallEnded upserts with onConflict: 'retell_call_id'
    const contractorData = {
      id: 'contractor-uuid',
      timezone: 'America/New_York',
      contractor_settings: null,
    }
    mockMaybeSingleContractor.mockResolvedValue({ data: contractorData, error: null })
    mockUpsert.mockReturnValue({ error: null })

    const call = makeCall()
    // Call processCallEnded twice with same call_id
    await processCallEnded(call)
    await processCallEnded(call)

    // upsert should have been called twice (idempotency is handled by DB onConflict)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    // Both calls must use onConflict: 'retell_call_id'
    const [firstCall, secondCall] = mockUpsert.mock.calls
    expect(firstCall[1]).toEqual({ onConflict: 'retell_call_id' })
    expect(secondCall[1]).toEqual({ onConflict: 'retell_call_id' })
  })

  it('never uses contractor_id from payload — always looks up by agent_id (T-03-02)', async () => {
    const contractorData = {
      id: 'contractor-server-derived-id',  // id comes from DB lookup, not payload
      timezone: 'America/New_York',
      contractor_settings: null,
    }
    mockMaybeSingleContractor.mockResolvedValue({ data: contractorData, error: null })
    mockUpsert.mockReturnValue({ error: null })

    const call = makeCall({ agent_id: 'agent-xyz', call_id: 'call-t03-02' })
    await processCallEnded(call)

    // 1. Contractor lookup MUST have occurred (maybeSingle was called)
    expect(mockMaybeSingleContractor).toHaveBeenCalledTimes(1)

    // 2. The upsert must use contractor_id from the DB lookup result (not from payload)
    // This verifies T-03-02: contractor_id is derived server-side
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        retell_call_id: 'call-t03-02',
        contractor_id: 'contractor-server-derived-id',  // from DB, not payload
      }),
      expect.objectContaining({ onConflict: 'retell_call_id' })
    )

    // 3. No call to upsert should contain a contractor_id matching any payload value
    // (the payload has no contractor_id — agent_id 'agent-xyz' is what was passed)
    const upsertPayload = mockUpsert.mock.calls[0][0]
    expect(upsertPayload.contractor_id).not.toBe('agent-xyz')
  })

  it('sets analysis_status=analyzing on call_ended skeleton row (D-02)', async () => {
    const contractorData = {
      id: 'contractor-uuid',
      timezone: 'America/New_York',
      contractor_settings: null,
    }
    mockMaybeSingleContractor.mockResolvedValue({ data: contractorData, error: null })
    mockUpsert.mockReturnValue({ error: null })

    const call = makeCall()
    await processCallEnded(call)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis_status: 'analyzing',
        status: 'completed',
        retell_call_id: 'call-123',
        contractor_id: 'contractor-uuid',
      }),
      expect.objectContaining({ onConflict: 'retell_call_id' })
    )
  })
})
