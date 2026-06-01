// tests/api/notifications/[id]/mark-as-read.spec.ts
// Phase 17, Plan 04 (Wave 2) — RED tests for PATCH /api/notifications/[id]/mark-as-read
// Tests IDOR guard, idempotency, and success case.
//
// Requirements: BELL-05 (mark-as-read feature)

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
import { PATCH } from '@/app/api/notifications/[id]/mark-as-read/route'

const mockUser = { id: 'user-123' }
const mockContractor = { id: 'contractor-456' }
const mockNotification = {
  id: 'notif-789',
  contractor_id: 'contractor-456',
  is_read: false,
}

const mockNotificationRead = {
  id: 'notif-789',
  contractor_id: 'contractor-456',
  is_read: true,
}

/**
 * Builds a Supabase server client mock with optional user.
 */
function makeServerMock(user: object | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

/**
 * Builds a Supabase service client mock.
 * Handles contractor lookup and notification SELECT + UPDATE.
 *
 * @param contractorData - Contractor row (null = not found)
 * @param notificationData - Notification row for SELECT (null = not found)
 * @param updateSuccess - Whether UPDATE should succeed (true/false)
 */
function makeServiceMock(
  contractorData: object | null,
  notificationData: object | null = mockNotification,
  updateSuccess = true
) {
  // Contractor SELECT chain: .from('contractors').select('id').eq('user_id', ...).maybeSingle()
  const contractorMaybeSingle = vi.fn().mockResolvedValue({
    data: contractorData,
    error: contractorData === null ? { message: 'not found' } : null,
  })
  const contractorEq = vi.fn(() => ({ maybeSingle: contractorMaybeSingle }))
  const contractorSelect = vi.fn(() => ({ eq: contractorEq }))

  // Notification SELECT chain: .from('app_notifications').select('id, is_read').eq('id', ...).eq('contractor_id', ...).maybeSingle()
  const notifMaybeSingle = vi.fn().mockResolvedValue({
    data: notificationData,
    error: null,
  })
  const notifEqContractor = vi.fn(() => ({ maybeSingle: notifMaybeSingle }))
  const notifEqId = vi.fn(() => ({ eq: notifEqContractor }))
  const notifSelect = vi.fn(() => ({ eq: notifEqId }))

  // Notification UPDATE chain: .from('app_notifications').update({...}).eq('id', ...).eq('contractor_id', ...)
  const updateEqContractor = vi.fn().mockResolvedValue({
    error: updateSuccess ? null : { message: 'update failed' },
  })
  const updateEqId = vi.fn(() => ({ eq: updateEqContractor }))
  const update = vi.fn(() => ({ eq: updateEqId }))

  const from = vi.fn((table: string) => {
    if (table === 'contractors') {
      return { select: contractorSelect }
    } else if (table === 'app_notifications') {
      // Return either SELECT or UPDATE based on which chain is being called
      // We'll use a trick: check the previous call context
      // For simplicity, we return an object with both paths
      return {
        select: notifSelect,
        update: update,
      }
    }
  })

  return {
    from,
    _contractorEq: contractorEq,
    _notifEqId: notifEqId,
    _notifEqContractor: notifEqContractor,
    _updateEqId: updateEqId,
  }
}

describe('PATCH /api/notifications/[id]/mark-as-read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks notification as read and returns 200', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor, mockNotification)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const context = { params: Promise.resolve({ id: 'notif-789' }) }
    const res = await PATCH({} as any, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('prevents IDOR: different contractor cannot mark another contractor\'s notification', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )

    // Contractor lookup succeeds (contractor-456), but notification belongs to a different contractor
    const serviceMock = makeServiceMock(
      mockContractor,
      null  // Notification not found for this contractor (IDOR)
    )
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const context = { params: Promise.resolve({ id: 'notif-999' }) }
    const res = await PATCH({} as any, context)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('idempotent: double-submit returns same result', async () => {
    ;(createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerMock(mockUser)
    )
    const serviceMock = makeServiceMock(mockContractor, mockNotification)
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceMock)

    const context = { params: Promise.resolve({ id: 'notif-789' }) }

    // First submit
    const res1 = await PATCH({} as any, context)
    expect(res1.status).toBe(200)

    // Second submit (idempotent — notification already marked read, but operation succeeds)
    const res2 = await PATCH({} as any, context)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.ok).toBe(true)
  })
})
