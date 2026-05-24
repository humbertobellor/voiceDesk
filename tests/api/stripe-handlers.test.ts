// tests/api/stripe-handlers.test.ts
// Unit tests for Stripe webhook handlers.
// Covers: T-07-02-02 (idempotency), tier mapping from metadata, payment failure dispatch.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockInsert, mockUpdate, mockSelect, mockInngestSend } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockInngestSend: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'webhook_events') {
        return { insert: mockInsert }
      }
      // contractors table
      return {
        update: mockUpdate,
        select: mockSelect,
      }
    }),
  })),
}))

vi.mock('@/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}))

import {
  handleCheckoutCompleted,
  handlePaymentFailed,
  handleSubscriptionUpdated,
} from '@/app/api/webhooks/stripe/handlers'
import type Stripe from 'stripe'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    customer: 'cus_abc',
    subscription: 'sub_xyz',
    metadata: { contractor_id: 'contractor-uuid', price_id: 'price_1TWnwOPUnGyJvc3kBUtjnla1' },
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

function makeInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: 'in_test_456',
    object: 'invoice',
    customer: 'cus_abc',
    hosted_invoice_url: 'https://invoice.stripe.com/test',
    subscription: 'sub_xyz',
    ...overrides,
  } as unknown as Stripe.Invoice
}

function makeSubscription(
  status: Stripe.Subscription.Status,
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: 'sub_xyz',
    object: 'subscription',
    customer: 'cus_abc',
    status,
    ...overrides,
  } as unknown as Stripe.Subscription
}

// ── handleCheckoutCompleted ───────────────────────────────────────────────────

describe('handleCheckoutCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set env vars for tier map — tier map reads from process.env (HIGH-04 fix)
    process.env.STRIPE_BASIC_PLAN_ID = 'price_1TWnwOPUnGyJvc3kBUtjnla1'
    process.env.STRIPE_PROFESSIONAL_PLAN_ID = 'price_1TWnzFPUnGyJvc3kCPGRXcLT'
    process.env.STRIPE_ENTERPRISE_PLAN_ID = 'price_1TWo0zPUnGyJvc3k9qnsukB5'
    // Default: idempotency insert succeeds (new event)
    mockInsert.mockResolvedValue({ error: null })
    // Default: contractor update succeeds
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  })

  it('skips processing for duplicate events (T-07-02-02)', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505' } })
    await handleCheckoutCompleted(makeSession())
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns early when contractor_id is missing from metadata', async () => {
    await handleCheckoutCompleted(makeSession({ metadata: {} }))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('maps basic price_id to "basic" tier', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    await handleCheckoutCompleted(
      makeSession({ metadata: { contractor_id: 'c-1', price_id: 'price_1TWnwOPUnGyJvc3kBUtjnla1' } })
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'basic' })
    )
  })

  it('maps professional price_id to "professional" tier', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    await handleCheckoutCompleted(
      makeSession({ metadata: { contractor_id: 'c-1', price_id: 'price_1TWnzFPUnGyJvc3kCPGRXcLT' } })
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'professional' })
    )
  })

  it('maps enterprise price_id to "enterprise" tier', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    await handleCheckoutCompleted(
      makeSession({ metadata: { contractor_id: 'c-1', price_id: 'price_1TWo0zPUnGyJvc3k9qnsukB5' } })
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'enterprise' })
    )
  })

  it('returns early (no DB update) when price_id is unrecognised (HIGH-04 fail-fast)', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    await handleCheckoutCompleted(
      makeSession({ metadata: { contractor_id: 'c-1', price_id: 'price_unknown' } })
    )

    // Unknown price IDs now fail-fast instead of silently defaulting to 'basic'
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sets subscription_status to "trialing" (D-02)', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    await handleCheckoutCompleted(makeSession())

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: 'trialing' })
    )
  })

  it('reads tier from metadata.price_id, not from line_items', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    // Session has no line_items property at all — tier must come from metadata
    const session = makeSession({
      metadata: { contractor_id: 'c-1', price_id: 'price_1TWnzFPUnGyJvc3kCPGRXcLT' },
    })
    delete (session as any).line_items

    await handleCheckoutCompleted(session)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'professional' })
    )
  })
})

// ── handlePaymentFailed ───────────────────────────────────────────────────────

describe('handlePaymentFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'contractor-uuid' }, error: null }),
      }),
    })
    mockInngestSend.mockResolvedValue(undefined)
  })

  it('skips processing for duplicate events (T-07-02-02)', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505' } })
    await handlePaymentFailed(makeInvoice())
    expect(mockInngestSend).not.toHaveBeenCalled()
  })

  it('sends stripe/payment.failed Inngest event with contractorId', async () => {
    await handlePaymentFailed(makeInvoice())

    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'stripe/payment.failed',
        data: expect.objectContaining({ contractorId: 'contractor-uuid' }),
      })
    )
  })

  it('skips Inngest send when contractor is not found', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
    })

    await handlePaymentFailed(makeInvoice())
    expect(mockInngestSend).not.toHaveBeenCalled()
  })
})

// ── handleSubscriptionUpdated ─────────────────────────────────────────────────

describe('handleSubscriptionUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'contractor-uuid' }, error: null }),
      }),
    })
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  })

  it('skips processing for duplicate events (T-07-02-02)', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505' } })
    await handleSubscriptionUpdated(makeSubscription('active'), 'evt_test_123')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it.each([
    ['trialing', 'trialing'],
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['unpaid', 'canceled'],
    ['incomplete_expired', 'canceled'],
  ])('maps Stripe status "%s" to internal status "%s"', async (stripeStatus, internalStatus) => {
    await handleSubscriptionUpdated(makeSubscription(stripeStatus as Stripe.Subscription.Status), 'evt_test_123')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: internalStatus })
    )
  })

  it('skips update when contractor is not found', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
    })

    await handleSubscriptionUpdated(makeSubscription('active'), 'evt_test_123')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
