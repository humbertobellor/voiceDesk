// tests/notifications/bell-formatter.test.ts
// RED test stubs for computeBellNotification() — Plan 14-01 (TDD Wave 0).
// All 5 stubs FAIL until Plan 14-02 exports computeBellNotification from
// src/inngest/functions/retell-notify-dispatch.ts.
//
// Mock ordering: vi.mock() calls must come before any imports that transitively
// depend on them (Vitest hoisting requirement).

vi.mock('server-only', () => ({}))
vi.mock('@/lib/notifications/sms', () => ({ sendSms: vi.fn() }))
vi.mock('@/lib/notifications/whatsapp', () => ({ sendWhatsApp: vi.fn() }))
vi.mock('@/lib/notifications/telegram', () => ({ sendTelegram: vi.fn() }))
vi.mock('@/lib/notifications/log', () => ({
  writeNotificationLog: vi.fn(),
  updateNotificationLog: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: vi.fn() }),
}))
vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, handler: unknown) => ({ _handler: handler })),
  },
}))

import { describe, it } from 'vitest'

// computeBellNotification is NOT exported yet — Plan 14-02 will add it.
// The dynamic import is used so this file loads even before the export exists;
// the stubs fail at assertion time, not at module-load time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let computeBellNotification: (...args: any[]) => any

try {
  // Will succeed at module load once Plan 14-02 adds the export;
  // until then the destructuring produces undefined, making each stub RED.
  const mod = await import('@/inngest/functions/retell-notify-dispatch')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeBellNotification = (mod as any).computeBellNotification
} catch {
  // Module load failure — stubs will throw 'not implemented' below.
  computeBellNotification = () => { throw new Error('not implemented — implement in Plan 14-02') }
}

/** Safely call computeBellNotification, throwing if not yet implemented. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callFormatter(...args: any[]): any {
  if (typeof computeBellNotification !== 'function') {
    throw new Error('not implemented — computeBellNotification not exported yet (implement in Plan 14-02)')
  }
  return computeBellNotification(...args)
}

describe('computeBellNotification — intent → event_type + title + body', () => {
  // Test 1: lead intent — event_type='lead', title='New lead — HVAC repair', body contains caller phone
  it("intent='lead' → event_type='lead', title contains service_type, body contains caller phone", () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation:
    // const result = callFormatter('lead', '+15551234567', 'HVAC repair', 'Appointment booked')
    // expect(result.event_type).toBe('lead')
    // expect(result.title).toBe('New lead — HVAC repair')
    // expect(result.body).toContain('+15551234567')
  })

  // Test 2: emergency intent — event_type='emergency', title starts with 'EMERGENCY:', body contains caller phone
  it("intent='emergency' → event_type='emergency', title starts with 'EMERGENCY:', body contains caller phone", () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation:
    // const result = callFormatter('emergency', '+15559999999', 'gas smell', 'No appointment booked')
    // expect(result.event_type).toBe('emergency')
    // expect(result.title).toMatch(/^EMERGENCY:/)
    // expect(result.body).toContain('+15559999999')
  })

  // Test 3: info intent — event_type='system', title='General inquiry from {phone}', body contains phone
  it("intent='info' → event_type='system', title='General inquiry from {phone}', body contains phone", () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation:
    // const result = callFormatter('info', '+15550000000', 'General inquiry', 'No appointment booked')
    // expect(result.event_type).toBe('system')
    // expect(result.title).toBe('General inquiry from +15550000000')
    // expect(result.body).toContain('+15550000000')
  })

  // Test 4: null intent — event_type='system', no throw (graceful null handling per Pitfall 6)
  it('intent=null → event_type=\'system\', does not throw', () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation:
    // expect(() => callFormatter(null, '+15550000000', 'Unknown', 'No appointment booked')).not.toThrow()
    // const result = callFormatter(null, '+15550000000', 'Unknown', 'No appointment booked')
    // expect(result.event_type).toBe('system')
  })

  // Test 5: no_action intent — event_type='system', no throw (graceful per Pitfall 6)
  it("intent='no_action' → event_type='system', does not throw", () => {
    throw new Error('not implemented — implement in Plan 14-02')
    // Expected after implementation:
    // expect(() => callFormatter('no_action', '+15550000000', 'Unknown', 'No appointment booked')).not.toThrow()
    // const result = callFormatter('no_action', '+15550000000', 'Unknown', 'No appointment booked')
    // expect(result.event_type).toBe('system')
  })
})
