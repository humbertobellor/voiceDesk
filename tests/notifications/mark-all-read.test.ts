// tests/notifications/mark-all-read.test.ts
// GREEN tests for PATCH /api/notifications/mark-all-read — Plan 14-03.
//
// Mock ordering: vi.mock() calls must come before any imports that transitively
// depend on them (Vitest hoisting requirement).

vi.mock('server-only', () => ({}))

// Default mock: no auth session (Test 1 baseline)
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    })),
  },
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

describe('PATCH /api/notifications/mark-all-read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: No auth session → 401
  it('returns 401 when no auth session', async () => {
    // Arrange: getUser returns null user (default mock)
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  // Test 2: Auth present, contractor not found → 404
  it('returns 404 when authenticated user has no contractor record', async () => {
    // Arrange: user present but contractor lookup returns null
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createServiceRoleClient>)

    const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    const res = await PATCH(req)
    expect(res.status).toBe(404)
  })

  // Test 3: Auth + contractor present, update succeeds → 200 { ok: true }
  it('returns 200 { ok: true } when auth and contractor found', async () => {
    // Arrange: user present, contractor found, update succeeds
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    // Create reusable chain builder that properly resolves
    const createChain = (resolveValue: unknown = { error: null }) => {
      const chain = {
        select: vi.fn(function() { return createChain(resolveValue) }),
        eq: vi.fn(function() { return createChain(resolveValue) }),
        update: vi.fn(function() { return createChain(resolveValue) }),
        limit: vi.fn(function() { return createChain(resolveValue) }),
        in: vi.fn(function() { return createChain(resolveValue) }),
        maybeSingle: vi.fn().mockResolvedValue(resolveValue),
      }
      // Make the chain awaitable (returns the resolveValue)
      return Object.assign(Promise.resolve(resolveValue), chain)
    }

    const mockFrom = vi.fn((table: string) => {
      if (table === 'contractors') {
        return createChain({ data: { id: 'cid-456' }, error: null })
      } else if (table === 'app_notifications') {
        // First call: select unread notifications
        // Second call: update them
        let callCount = 0
        return createChain({ data: callCount === 0 ? [{ id: 'notif-1' }] : null, error: null })
      }
      return createChain()
    })
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createServiceRoleClient>)

    const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
