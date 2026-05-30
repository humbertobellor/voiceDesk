// tests/actions/telegram-webhook.test.ts
// RED test stubs for activateTelegramWebhook() server action.
// Plan 15-01, Wave 0 — all tests fail at import time because
// src/app/(dashboard)/settings/notifications/actions.ts does not exist yet.
//
// Test IDs: 15-W0-02-a, 15-W0-02-b, 15-01-02-a through 15-01-02-d, 15-01-03-a

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock ordering (Vitest hoisting requirement) ──────────────────────────────
vi.mock('server-only', () => ({}))

const { mockSetWebhook, mockGetWebhookInfo } = vi.hoisted(() => {
  const mockSetWebhook = vi.fn()
  const mockGetWebhookInfo = vi.fn()
  return { mockSetWebhook, mockGetWebhookInfo }
})

vi.mock('grammy', () => ({
  Bot: vi.fn(function () {
    return {
      api: {
        sendMessage: vi.fn(),
        setWebhook: mockSetWebhook,
        getWebhookInfo: mockGetWebhookInfo,
      },
    }
  }),
}))

vi.mock('@/lib/notifications/telegram', () => ({
  getBot: vi.fn(() => ({
    api: {
      setWebhook: mockSetWebhook,
      getWebhookInfo: mockGetWebhookInfo,
    },
  })),
}))

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
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

// ── Import after mocks (file does not exist yet — import fails, making tests RED) ──
import { activateTelegramWebhook } from '@/app/(dashboard)/settings/notifications/actions'

import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

// ── Test data ─────────────────────────────────────────────────────────────────

const VALID_WEBHOOK_INFO = {
  url: 'https://voicedesk.vercel.app/api/webhooks/telegram',
  has_custom_certificate: false,
  pending_update_count: 0,
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('activateTelegramWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set valid env vars by default; individual tests override for failure cases
    process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token:123456'
    process.env.TELEGRAM_WEBHOOK_URL = 'https://voicedesk.vercel.app/api/webhooks/telegram'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-random-hex-secret'

    // Default mock implementations
    mockSetWebhook.mockResolvedValue(true)
    mockGetWebhookInfo.mockResolvedValue(VALID_WEBHOOK_INFO)
  })

  // ── Test 15-W0-02-a: Unauthenticated request ─────────────────────────────
  it('returns { ok: false, error: "Not signed in." } when getUser() returns null user', async () => {
    // Arrange: default mock returns null user
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result).toEqual({ ok: false, error: 'Not signed in.' })
    expect(mockSetWebhook).not.toHaveBeenCalled()
  })

  // ── Test 15-W0-02-b: Contractor not found ────────────────────────────────
  it('returns { ok: false, error: "Contractor not found." } when contractor lookup returns null', async () => {
    // Arrange: authenticated user but no contractor record
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    const contractorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => contractorChain),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/contractor not found/i)
    }
    expect(mockSetWebhook).not.toHaveBeenCalled()
  })

  // ── Test 15-01-02-a: Missing TELEGRAM_WEBHOOK_URL ────────────────────────
  it('returns { ok: false, error: containing "not configured" } when TELEGRAM_WEBHOOK_URL env var is missing', async () => {
    // Arrange: authenticated + contractor found, but missing env var
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cid-456' }, error: null }),
      })),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    delete process.env.TELEGRAM_WEBHOOK_URL

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not configured/i)
    }
    expect(mockSetWebhook).not.toHaveBeenCalled()
  })

  // ── Test 15-01-02-b: HTTP (non-HTTPS) TELEGRAM_WEBHOOK_URL ──────────────
  it('returns { ok: false, error: containing "HTTPS" } when TELEGRAM_WEBHOOK_URL is http:// (not HTTPS)', async () => {
    // Arrange: authenticated + contractor found, but URL is HTTP not HTTPS
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cid-456' }, error: null }),
      })),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    process.env.TELEGRAM_WEBHOOK_URL = 'http://voicedesk.vercel.app/api/webhooks/telegram'

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/https/i)
    }
    expect(mockSetWebhook).not.toHaveBeenCalled()
  })

  // ── Test 15-01-02-c: Missing TELEGRAM_WEBHOOK_SECRET ────────────────────
  it('returns { ok: false, error: containing "not configured" } when TELEGRAM_WEBHOOK_SECRET env var is missing', async () => {
    // Arrange: authenticated + contractor found + valid URL, but missing secret
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cid-456' }, error: null }),
      })),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    delete process.env.TELEGRAM_WEBHOOK_SECRET

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not configured/i)
    }
    expect(mockSetWebhook).not.toHaveBeenCalled()
  })

  // ── Test 15-01-02-d: Happy path — setWebhook + getWebhookInfo called ────
  it('calls bot.api.setWebhook(url, { secret_token }) and bot.api.getWebhookInfo() on valid input; returns { ok: true, webhookInfo }', async () => {
    // Arrange: all valid — auth, contractor, env vars
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cid-456' }, error: null }),
      })),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    // Act
    const result = await activateTelegramWebhook()

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.webhookInfo).toEqual(VALID_WEBHOOK_INFO)
    }
    expect(mockSetWebhook).toHaveBeenCalledWith(
      'https://voicedesk.vercel.app/api/webhooks/telegram',
      { secret_token: 'test-random-hex-secret' }
    )
    expect(mockGetWebhookInfo).toHaveBeenCalled()
  })

  // ── Test 15-01-03-a: setWebhook throws — error returned, not thrown ──────
  it('returns { ok: false, error: string } (does NOT throw) when bot.api.setWebhook() throws', async () => {
    // Arrange: all valid env vars, but setWebhook throws
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServer>>)

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cid-456' }, error: null }),
      })),
    } as unknown as ReturnType<typeof createServiceRoleClient>)

    mockSetWebhook.mockRejectedValue(new Error('Telegram API unreachable'))

    // Act — must not throw; must return structured error.
    // Note: expect(asyncFn).not.toThrow() only checks synchronous throws in Vitest.
    // We use a direct await to verify the async function resolves (not rejects) AND
    // returns a structured error, which is the actual intent of this test.
    const result = await activateTelegramWebhook()

    expect(result).toBeDefined()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})
