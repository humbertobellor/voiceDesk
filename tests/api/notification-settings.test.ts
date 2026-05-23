// tests/api/notification-settings.test.ts
// Phase 10 RED: Wave 0 test stubs for PATCH /api/notification-settings.
// All tests throw 'not yet implemented' — implementation added in a later wave.
// Stubs cover: auth enforcement, E.164 normalization, 422 on invalid number,
//   IDOR guard (contractor_id from session), all 8 fields persisted.
import { describe, it } from 'vitest'

// Route will not exist until Wave 1 — import is deferred inside tests to keep stubs RED.
// import { PATCH } from '@/app/api/notification-settings/route'

describe('PATCH /api/notification-settings', () => {
  it('returns 401 when not authenticated', () => {
    throw new Error('not yet implemented')
  })

  it('normalizes sms_number to E.164 (+13055551234) before storing', () => {
    throw new Error('not yet implemented')
  })

  it('normalizes whatsapp_number to E.164 before storing', () => {
    throw new Error('not yet implemented')
  })

  it('returns 422 for invalid phone number format', () => {
    throw new Error('not yet implemented')
  })

  it('derives contractor_id from session, never from request body (IDOR guard)', () => {
    throw new Error('not yet implemented')
  })

  it('persists all 8 fields: sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled, notify_on_lead, notify_on_emergency, notify_on_general_inquiry', () => {
    throw new Error('not yet implemented')
  })
})
