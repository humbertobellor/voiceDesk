// tests/api/stripe-checkout.test.ts
// Unit tests for POST /api/stripe/checkout.
// Covers: auth guard (no contractorId from body), tier validation, active-subscription guard.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockGetUser, mockMaybySingle, mockCreateCheckout } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybySingle: vi.fn(),
  mockCreateCheckout: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybySingle,
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/stripe/checkout', () => ({
  createCheckoutSession: mockCreateCheckout,
}))

import { POST } from '@/app/api/stripe/checkout/route'

function makeRequest(body: object) {
  return new Request('http://localhost/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockContractor = { id: 'contractor-uuid', subscription_status: 'trialing' }

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_BASIC_PLAN_ID = 'price_basic'
    process.env.STRIPE_PROFESSIONAL_PLAN_ID = 'price_pro'
    process.env.STRIPE_ENTERPRISE_PLAN_ID = 'price_ent'
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ tier: 'basic' }))
    expect(res.status).toBe(401)
    expect(mockCreateCheckout).not.toHaveBeenCalled()
  })

  it('returns 400 when tier is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({ data: mockContractor, error: null })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing tier/i)
  })

  it('returns 400 when tier is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeRequest({ tier: 'premium' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid tier/i)
  })

  it('returns 404 when no contractor exists for the authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const res = await POST(makeRequest({ tier: 'basic' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when contractor already has an active subscription', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({
      data: { ...mockContractor, subscription_status: 'active' },
      error: null,
    })

    const res = await POST(makeRequest({ tier: 'basic' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/active subscription/i)
  })

  it('returns checkout URL for valid authenticated request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({ data: mockContractor, error: null })
    mockCreateCheckout.mockResolvedValue('https://checkout.stripe.com/pay/cs_test')

    const res = await POST(makeRequest({ tier: 'basic' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/pay/cs_test')
  })

  it('passes the correct priceId for each tier', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({ data: mockContractor, error: null })
    mockCreateCheckout.mockResolvedValue('https://checkout.stripe.com/pay/cs_test')

    for (const [tier, priceId] of [
      ['basic', 'price_basic'],
      ['professional', 'price_pro'],
      ['enterprise', 'price_ent'],
    ] as const) {
      vi.clearAllMocks()
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mockMaybySingle.mockResolvedValue({ data: mockContractor, error: null })
      mockCreateCheckout.mockResolvedValue('https://checkout.stripe.com/pay/cs_test')

      await POST(makeRequest({ tier }))

      expect(mockCreateCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          contractorId: 'contractor-uuid',
          priceId,
        })
      )
    }
  })

  it('derives contractorId from session — ignores any contractorId in request body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMaybySingle.mockResolvedValue({ data: mockContractor, error: null })
    mockCreateCheckout.mockResolvedValue('https://checkout.stripe.com/pay/cs_test')

    // Attacker passes a different contractorId — should be ignored
    await POST(makeRequest({ tier: 'basic', contractorId: 'attacker-target-uuid' }))

    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ contractorId: 'contractor-uuid' })
    )
    expect(mockCreateCheckout).not.toHaveBeenCalledWith(
      expect.objectContaining({ contractorId: 'attacker-target-uuid' })
    )
  })
})
