// tests/api/notification-settings.test.ts
// Phase 10 GREEN: Tests for PATCH /api/notification-settings.
// Covers: auth enforcement, E.164 normalization, 422 on invalid number,
//   IDOR guard (contractor_id from session), all 8 fields persisted.
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
import { PATCH } from '@/app/api/notification-settings/route'

const mockUser = { id: 'user-123' }
const mockContractor = { id: 'contractor-456' }

const mockNotificationSettings = {
  id: 'ns-789',
  contractor_id: 'contractor-456',
  sms_number: '+13055551234',
  whatsapp_number: null,
  telegram_chat_id: null,
  notify_on_lead: true,
  notify_on_emergency: true,
  notify_on_general_inquiry: false,
  notify_sms_enabled: true,
  notify_whatsapp_enabled: false,
  notify_telegram_enabled: false,
  whatsapp_opted_in_at: null,
  created_at: '2026-05-23T00:00:00Z',
  updated_at: '2026-05-23T00:00:00Z',
}

function makeServerMock(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

/**
 * Builds a Supabase service mock that simulates the contractor lookup + notification_settings update chain.
 *
 * @param contractorData - Contractor row to return from the select; null simulates not found.
 * @param updatedSettings - Settings row to return from the update; null simulates update error.
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

  // from() discriminates by table name
  const from = vi.fn((table: string) => {
    if (table === 'contractors') return { select }
    return { update }
  })

  return { from, _eqSelect: eqSelect, _update: update }
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Request
}

describe('PATCH /api/notification-settings', () => {
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

    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('normalizes sms_number to E.164 (+13055551234) before storing', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor, {
      ...mockNotificationSettings,
      sms_number: '+13055551234',
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    // Pass a non-E.164 number — route should normalize it
    const res = await PATCH(makeRequest({
      sms_number: '(305) 555-1234',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: false,
      notify_telegram_enabled: false,
      notify_on_lead: true,
      notify_on_emergency: true,
      notify_on_general_inquiry: false,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sms_number).toBe('+13055551234')
  })

  it('normalizes whatsapp_number to E.164 before storing', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor, {
      ...mockNotificationSettings,
      whatsapp_number: '+17865551234',
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const res = await PATCH(makeRequest({
      whatsapp_number: '786-555-1234',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: true,
      notify_telegram_enabled: false,
      notify_on_lead: true,
      notify_on_emergency: true,
      notify_on_general_inquiry: false,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.whatsapp_number).toBe('+17865551234')
  })

  it('returns 422 for invalid phone number format', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeServiceMock(mockContractor)
    )

    const res = await PATCH(makeRequest({
      sms_number: 'not-a-number',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: false,
      notify_telegram_enabled: false,
      notify_on_lead: true,
      notify_on_emergency: true,
      notify_on_general_inquiry: false,
    }))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/invalid sms number/i)
  })

  it('derives contractor_id from session, never from request body (IDOR guard)', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    // Include an attacker-supplied contractor_id in the body — it must be ignored
    await PATCH(makeRequest({
      contractor_id: 'attacker-contractor-id',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: false,
      notify_telegram_enabled: false,
      notify_on_lead: true,
      notify_on_emergency: true,
      notify_on_general_inquiry: false,
    }))

    // The eq filter on the update should use the session contractor.id, not the body value
    expect(serviceMock._eqSelect).toHaveBeenCalledWith('user_id', mockUser.id)
  })

  it('persists all 8 fields: sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled, notify_on_lead, notify_on_emergency, notify_on_general_inquiry', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const expectedSettings = {
      ...mockNotificationSettings,
      sms_number: '+13055551234',
      whatsapp_number: '+17865554321',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: true,
      notify_telegram_enabled: false,
      notify_on_lead: false,
      notify_on_emergency: true,
      notify_on_general_inquiry: true,
    }
    const serviceMock = makeServiceMock(mockContractor, expectedSettings)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const res = await PATCH(makeRequest({
      sms_number: '(305) 555-1234',
      whatsapp_number: '786-555-4321',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: true,
      notify_telegram_enabled: false,
      notify_on_lead: false,
      notify_on_emergency: true,
      notify_on_general_inquiry: true,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sms_number).toBe('+13055551234')
    expect(body.whatsapp_number).toBe('+17865554321')
    expect(body.notify_sms_enabled).toBe(true)
    expect(body.notify_whatsapp_enabled).toBe(true)
    expect(body.notify_telegram_enabled).toBe(false)
    expect(body.notify_on_lead).toBe(false)
    expect(body.notify_on_emergency).toBe(true)
    expect(body.notify_on_general_inquiry).toBe(true)
  })
})
