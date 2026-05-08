import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockRefreshAccessToken } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: mockRefreshAccessToken,
        generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock'),
        getToken: vi.fn(),
      })),
    },
    calendar: vi.fn(),
  },
}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

describe('getCalendarClient token refresh (D-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'https://localhost:3000/api/auth/google/callback'
    process.env.OAUTH_ENCRYPTION_KEY = 'a'.repeat(64)
  })

  it('returns null when no calendar_credentials row exists (D-15)', () => {
    throw new Error('not yet implemented')
  })
  it('does NOT call refreshAccessToken when token_expiry > 5 minutes away', () => {
    throw new Error('not yet implemented')
  })
  it('calls refreshAccessToken and re-encrypts when token_expiry within 5 minutes (D-05)', () => {
    throw new Error('not yet implemented')
  })
  it('returns google.calendar client after successful refresh', () => {
    throw new Error('not yet implemented')
  })
})
