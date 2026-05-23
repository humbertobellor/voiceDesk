// tests/api/notification-settings-telegram-unlink.test.ts
// Phase 10 GREEN: Tests for POST /api/notification-settings/telegram/unlink.
// Covers: auth enforcement, sets telegram_chat_id = NULL, IDOR guard.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}))

// Mock Supabase service client
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { POST } from '@/app/api/notification-settings/telegram/unlink/route'

const mockUser = { id: 'user-123' }
const mockContractor = { id: 'contractor-456' }

const mockNotificationSettings = {
  id: 'ns-789',
  contractor_id: 'contractor-456',
  sms_number: '+13055551234',
  whatsapp_number: null,
  telegram_chat_id: null,   // unlinked — what we expect after POST
  notify_on_lead: true,
  notify_on_emergency: true,
  notify_on_general_inquiry: false,
  notify_sms_enabled: true,
  notify_whatsapp_enabled: false,
  notify_telegram_enabled: false,
  whatsapp_opted_in_at: null,
  created_at: '2026-05-23T00:00:00Z',
  updated_at: '2026-05-23T01:00:00Z',
}

function makeServerMock(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

/**
 * Builds a Supabase service mock for the unlink route:
 * contractor SELECT → notification_settings UPDATE (sets telegram_chat_id = null).
 *
 * @param contractorData - Contractor row; null simulates not found.
 * @param updatedSettings - Settings row returned after update.
 */
function makeServiceMock(
  contractorData: object | null,
  updatedSettings: object | null = mockNotificationSettings
) {
  const single = vi.fn().mockResolvedValue({
    data: updatedSettings,
    error: updatedSettings === null ? { message: 'update error' } : null,
  })
  const selectAfterUpdate = vi.fn(() => ({ single }))
  const eqUpdate = vi.fn(() => ({ select: selectAfterUpdate }))
  const update = vi.fn(() => ({ eq: eqUpdate }))

  const maybeSingle = vi.fn().mockResolvedValue({
    data: contractorData,
    error: contractorData === null ? { message: 'not found' } : null,
  })
  const eqSelect = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq: eqSelect }))

  const from = vi.fn((table: string) => {
    if (table === 'contractors') return { select }
    return { update }
  })

  return { from, _eqSelect: eqSelect, _update: update }
}

describe('POST /api/notification-settings/telegram/unlink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(null)
    )
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeServiceMock(mockContractor)
    )

    const res = await POST()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('sets telegram_chat_id = NULL for authenticated contractor', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor, {
      ...mockNotificationSettings,
      telegram_chat_id: null,
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    // Response should show telegram_chat_id cleared to null
    expect(body.telegram_chat_id).toBeNull()
  })

  it('derives contractor_id from session, not from request body', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    await POST()

    // The contractor lookup must filter by user_id from session
    expect(serviceMock._eqSelect).toHaveBeenCalledWith('user_id', mockUser.id)
  })
})
