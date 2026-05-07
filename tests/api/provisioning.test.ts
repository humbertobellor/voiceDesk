// tests/api/provisioning.test.ts
// Unit tests for POST /api/provisioning/create and PATCH /api/provisioning/update-agent.
// Retell SDK and Supabase clients are mocked — no live API calls.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

// Mock Supabase service client
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

// Mock Retell client
vi.mock('@/lib/retell/client', () => ({
  getRetellClient: vi.fn(),
  toRetellLanguage: vi.fn((langs: string[]) => langs.length === 1 ? `${langs[0]}-US` : langs.map(l => `${l.toUpperCase()}`)),
}))

// Mock system prompt builder
vi.mock('@/lib/retell/system-prompt', () => ({
  buildSystemPrompt: vi.fn(() => 'mocked system prompt'),
  buildBeginMessage: vi.fn(() => 'mocked begin message'),
}))

// Mock Inngest client
vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { POST } from '@/app/api/provisioning/create/route'
import { PATCH } from '@/app/api/provisioning/update-agent/route'

const mockUser = { id: 'user-123' }
const mockContractor = {
  id: 'contractor-456',
  retell_agent_id: null,
  retell_llm_id: null,
  contractor_settings: [{
    business_name: 'Test HVAC',
    trade_type: 'hvac',
    service_area: 'Miami',
    supported_languages: ['en'],
    emergency_keywords: { en: ['gas smell'], es: [] },
    after_hours_message: 'We are closed.',
    agent_voice: 'elevenlabs-myra',
  }],
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Request
}

function mockSupabaseChain(result: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: result, error: null }),
  }
  // Make update return a thenable that resolves to { error: null }
  ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  return chain
}

describe('POST /api/provisioning/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no authenticated user', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const res = await POST(makeRequest({ area_code: '305' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when area_code is invalid', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const res = await POST(makeRequest({ area_code: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when contractor is already provisioned', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain({ ...mockContractor, retell_agent_id: 'existing-agent-id' })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    const res = await POST(makeRequest({ area_code: '305' }))
    expect(res.status).toBe(409)
  })

  it('returns 422 with area code suggestions when no numbers available', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain(mockContractor)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(getRetellClient as ReturnType<typeof vi.fn>).mockReturnValue({
      llm: { create: vi.fn().mockResolvedValue({ llm_id: 'llm-123' }) },
      agent: { create: vi.fn().mockResolvedValue({ agent_id: 'agent-123' }) },
      phoneNumber: { create: vi.fn().mockRejectedValue(new Error('No numbers available')) },
    })
    const res = await POST(makeRequest({ area_code: '999' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('786')
    expect(body.error).toContain('954')
    expect(body.error).toContain('561')
  })

  it('returns 200 with twilio_number and retell_agent_id on success', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain(mockContractor)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(getRetellClient as ReturnType<typeof vi.fn>).mockReturnValue({
      llm: { create: vi.fn().mockResolvedValue({ llm_id: 'llm-123' }) },
      agent: { create: vi.fn().mockResolvedValue({ agent_id: 'agent-789' }) },
      phoneNumber: { create: vi.fn().mockResolvedValue({ phone_number: '+13055551234' }) },
    })
    const res = await POST(makeRequest({ area_code: '305' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.twilio_number).toBe('+13055551234')
    expect(body.retell_agent_id).toBe('agent-789')
  })
})

describe('PATCH /api/provisioning/update-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no authenticated user', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(401)
  })

  it('returns 404 when contractor has no retell_llm_id (not yet provisioned)', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain({ ...mockContractor, retell_llm_id: null })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(404)
  })

  it('returns 200 { ok: true } even when Retell sync fails (Inngest queued)', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain({ ...mockContractor, retell_llm_id: 'llm-existing' })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(getRetellClient as ReturnType<typeof vi.fn>).mockReturnValue({
      llm: { update: vi.fn().mockRejectedValue(new Error('Retell API down')) },
    })
    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 { ok: true } on successful Retell sync', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })
    const chain = mockSupabaseChain({ ...mockContractor, retell_llm_id: 'llm-existing' })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(getRetellClient as ReturnType<typeof vi.fn>).mockReturnValue({
      llm: { update: vi.fn().mockResolvedValue({}) },
    })
    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('sets agent_sync_status=pending BEFORE retell.llm.update() is called', async () => {
    // Call-order test: verifies pending write happens before Retell call (key link D-12)
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    })

    const callOrder: string[] = []

    // Spy on the pending update (separate mock to track call order)
    const mockPendingUpdate = vi.fn().mockImplementation(() => {
      callOrder.push('pending')
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    })
    // Spy on the synced update
    const mockSyncedUpdate = vi.fn().mockImplementation(() => {
      callOrder.push('synced')
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    })

    let updateCallCount = 0
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockContractor, retell_llm_id: 'llm-existing' },
        error: null,
      }),
      update: vi.fn().mockImplementation(() => {
        updateCallCount++
        // First update call = pending write; second = synced write
        return updateCallCount === 1 ? mockPendingUpdate() : mockSyncedUpdate()
      }),
    }
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain)

    // Spy on Retell update to record its call position
    const mockRetellUpdate = vi.fn().mockImplementation(async () => {
      callOrder.push('retell')
      return {}
    })
    ;(getRetellClient as ReturnType<typeof vi.fn>).mockReturnValue({
      llm: { update: mockRetellUpdate },
    })

    await PATCH(makeRequest({}))

    // Assert call order: pending must come before retell
    const pendingIdx = callOrder.indexOf('pending')
    const retellIdx = callOrder.indexOf('retell')
    expect(pendingIdx).toBeGreaterThanOrEqual(0)
    expect(retellIdx).toBeGreaterThanOrEqual(0)
    expect(pendingIdx).toBeLessThan(retellIdx)
  })
})
