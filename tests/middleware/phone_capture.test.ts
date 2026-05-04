// tests/middleware/phone_capture.test.ts
// Covers D-02 phone capture redirect (RESEARCH.md Pitfall 4).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr — controlled per-test
const mockGetUser = vi.fn()
const mockFromSelect = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockFromSelect,
        }),
      }),
    }),
  }),
}))

// Import middleware AFTER mock is in place
const { middleware } = await import('@/../middleware')

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`))
}

describe('middleware phone capture redirect (D-02 + Pitfall 4)', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockFromSelect.mockReset()
  })

  it('redirects unauthenticated user from /dashboard to /auth/login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(makeRequest('/dashboard'))
    expect(res?.headers.get('location')).toContain('/auth/login')
  })

  it('redirects authenticated user with no contractor row to /setup/phone', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFromSelect.mockResolvedValue({ data: null })
    const res = await middleware(makeRequest('/dashboard'))
    expect(res?.headers.get('location')).toContain('/setup/phone')
  })

  it('redirects authenticated user with contractor row but null phone_number to /setup/phone', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFromSelect.mockResolvedValue({ data: { phone_number: null } })
    const res = await middleware(makeRequest('/dashboard'))
    expect(res?.headers.get('location')).toContain('/setup/phone')
  })

  it('allows authenticated user with phone_number to access /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFromSelect.mockResolvedValue({ data: { phone_number: '+13055551234' } })
    const res = await middleware(makeRequest('/dashboard'))
    // No redirect — middleware returns NextResponse.next() (no location header)
    expect(res?.headers.get('location')).toBeNull()
  })
})
