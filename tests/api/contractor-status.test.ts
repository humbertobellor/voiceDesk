// tests/api/contractor-status.test.ts
// Unit tests for GET /api/contractor/status.
// Verifies auth enforcement, is_live flag, and that contractor_id is always derived
// from the session — never from query parameters (IDOR prevention).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

import { createSupabaseServer } from '@/lib/supabase/server'
import { GET } from '@/app/api/contractor/status/route'

const mockContractor = {
  subscription_status: 'trialing',
  twilio_number: '+13055551234',
  retell_agent_id: 'agent-abc',
  is_live: false,
}

function makeSupabaseMock(user: object | null, contractorData: object | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: contractorData,
    error: contractorData === null ? { message: 'not found' } : null,
  })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from,
    _eq: eq,
  }
}

describe('GET /api/contractor/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock(null, null)
    )

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when no contractor record exists for the user', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({ id: 'user-123' }, null)
    )

    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns subscription status, phone/agent flags, and is_live for authenticated user', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({ id: 'user-123' }, mockContractor)
    )

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription_status).toBe('trialing')
    expect(body.has_phone_number).toBe(true)
    expect(body.has_retell_agent).toBe(true)
    expect(body.is_live).toBe(false)
  })

  it('returns is_live=true when contractor is marked live', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({ id: 'user-123' }, { ...mockContractor, is_live: true })
    )

    const res = await GET()
    const body = await res.json()
    expect(body.is_live).toBe(true)
  })

  it('reports has_phone_number=false when twilio_number is null', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({ id: 'user-123' }, { ...mockContractor, twilio_number: null })
    )

    const res = await GET()
    const body = await res.json()
    expect(body.has_phone_number).toBe(false)
  })

  it('reports has_retell_agent=false when retell_agent_id is null', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({ id: 'user-123' }, { ...mockContractor, retell_agent_id: null })
    )

    const res = await GET()
    const body = await res.json()
    expect(body.has_retell_agent).toBe(false)
  })

  it('derives contractor from session user_id — route accepts no query parameters', async () => {
    const mock = makeSupabaseMock({ id: 'user-123' }, mockContractor)
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(mock)

    await GET()

    expect(mock.from).toHaveBeenCalledWith('contractors')
    expect(mock._eq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})
