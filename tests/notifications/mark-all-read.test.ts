// tests/notifications/mark-all-read.test.ts
// RED test stubs for PATCH /api/notifications/mark-all-read — Plan 14-01 (TDD Wave 0).
// All 3 stubs FAIL until Plan 14-02 creates the route handler at
// src/app/api/notifications/mark-all-read/route.ts.
//
// Mock ordering: vi.mock() calls must come before any imports that transitively
// depend on them (Vitest hoisting requirement).

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    })),
  },
}))

import { describe, it } from 'vitest'

// NOTE: The route module does not exist yet — Plan 14-02 will create it.
// The stubs intentionally throw 'not implemented' as their body so they are
// RED from the start and remain GREEN after implementation replaces the throws
// with real assertions. This avoids a static import of the non-existent module.

describe('PATCH /api/notifications/mark-all-read', () => {
  // Test 1: No auth session → 401
  it('returns 401 when no auth session', async () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation (route exists + no session mock):
    // const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    // const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    // const res = await PATCH(req)
    // expect(res.status).toBe(401)
  })

  // Test 2: Auth present, contractor not found → 404
  it('returns 404 when authenticated user has no contractor record', async () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation (user present, contractor missing):
    // const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    // const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    // const res = await PATCH(req)
    // expect(res.status).toBe(404)
  })

  // Test 3: Auth + contractor present, no unread → 200 { ok: true }
  it('returns 200 { ok: true } when auth and contractor found', async () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation (user + contractor present, update succeeds):
    // const req = new Request('http://localhost/api/notifications/mark-all-read', { method: 'PATCH' })
    // const { PATCH } = await import('@/app/api/notifications/mark-all-read/route')
    // const res = await PATCH(req)
    // expect(res.status).toBe(200)
    // expect(res.body).toEqual({ ok: true })
  })
})
