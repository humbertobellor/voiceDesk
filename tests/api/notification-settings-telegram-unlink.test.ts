// tests/api/notification-settings-telegram-unlink.test.ts
// Phase 10 RED: Wave 0 test stubs for POST /api/notification-settings/telegram/unlink.
// All tests throw 'not yet implemented' — implementation added in a later wave.
// Stubs cover: auth enforcement, NULL out telegram_chat_id, IDOR guard.
import { describe, it } from 'vitest'

// Route will not exist until Wave 1 — import is deferred inside tests to keep stubs RED.
// import { POST } from '@/app/api/notification-settings/telegram/unlink/route'

describe('POST /api/notification-settings/telegram/unlink', () => {
  it('returns 401 when not authenticated', () => {
    throw new Error('not yet implemented')
  })

  it('sets telegram_chat_id = NULL for authenticated contractor', () => {
    throw new Error('not yet implemented')
  })

  it('derives contractor_id from session, not from request body', () => {
    throw new Error('not yet implemented')
  })
})
