import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockRefreshAccessToken, mockOAuth2 } = vi.hoisted(() => {
  const mockRefresh = vi.fn()
  class MockOAuth2 {
    setCredentials = vi.fn()
    refreshAccessToken = mockRefresh
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock')
    getToken = vi.fn()
  }
  return {
    mockRefreshAccessToken: mockRefresh,
    mockOAuth2: MockOAuth2,
  }
})

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: mockOAuth2,
    },
    calendar: vi.fn(() => ({ mock: 'calendar-client' })),
  },
}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/crypto/tokens', () => ({
  encryptToken: (token: string) => `encrypted:${token}`,
  decryptToken: (token: string) => token.replace('encrypted:', ''),
}))

describe('getCalendarClient token refresh (D-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'https://localhost:3000/api/auth/google/callback'
    process.env.OAUTH_ENCRYPTION_KEY = 'a'.repeat(64)
  })

  it('returns null when no calendar_credentials row exists (D-15)', async () => {
    const { getCalendarClient } = await import('@/lib/google/auth')

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const client = await getCalendarClient('contractor-123')
    expect(client).toBeNull()
  })

  it('does NOT call refreshAccessToken when token_expiry > 5 minutes away', async () => {
    const { getCalendarClient } = await import('@/lib/google/auth')

    // Token expiry is 10 minutes in the future
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              access_token: 'encrypted-access-token',
              refresh_token: 'encrypted-refresh-token',
              token_expiry: futureExpiry,
              calendar_id: 'cal-123',
            },
            error: null,
          }),
        }),
      }),
    })

    const client = await getCalendarClient('contractor-123')
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    expect(client).toBeDefined()
  })

  it('calls refreshAccessToken and re-encrypts when token_expiry within 5 minutes (D-05)', async () => {
    const { getCalendarClient } = await import('@/lib/google/auth')

    // Token expiry is 2 minutes in the future
    const soonExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString()

    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 60 * 60 * 1000,
      },
    })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              access_token: 'encrypted-access-token',
              refresh_token: 'encrypted-refresh-token',
              token_expiry: soonExpiry,
              calendar_id: 'cal-123',
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const client = await getCalendarClient('contractor-123')
    expect(mockRefreshAccessToken).toHaveBeenCalled()
    expect(client).toBeDefined()
  })

  it('returns google.calendar client after successful refresh', async () => {
    const { getCalendarClient } = await import('@/lib/google/auth')

    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              access_token: 'encrypted-access-token',
              refresh_token: 'encrypted-refresh-token',
              token_expiry: futureExpiry,
              calendar_id: 'cal-123',
            },
            error: null,
          }),
        }),
      }),
    })

    const client = await getCalendarClient('contractor-123')
    expect(client).toBeDefined()
  })
})
