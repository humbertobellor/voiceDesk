import { describe, it, expect, vi, beforeEach } from 'vitest'

// All vi.mock calls must come before imports that transitively depend on them.
// Factory functions use only vi.fn() inline to avoid hoisting initialisation order issues.

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

// Import computeChannels — this will FAIL until Plan 13-03 extends the function
// to return shouldSendEmail.  Expected RED state for Tasks 1-2.
import { computeChannels } from '@/inngest/functions/retell-notify-dispatch'
import type { NotificationSettings, CallIntent } from '@/types/database'

/**
 * Builds a minimal NotificationSettings-compatible object that includes the email
 * channel fields introduced in Phase 12.
 *
 * Defaults: email channel disabled (notify_email_enabled=false, email_address=null)
 * so tests must explicitly opt in to trigger shouldSendEmail=true.
 */
function makeEmailSettings(
  overrides: Partial<
    Pick<
      NotificationSettings,
      | 'sms_number'
      | 'whatsapp_number'
      | 'telegram_chat_id'
      | 'notify_on_lead'
      | 'notify_on_emergency'
      | 'notify_on_general_inquiry'
      | 'notify_sms_enabled'
      | 'notify_whatsapp_enabled'
      | 'notify_telegram_enabled'
      | 'notify_email_enabled'
      | 'email_address'
    >
  > = {}
): Pick<
  NotificationSettings,
  | 'sms_number'
  | 'whatsapp_number'
  | 'telegram_chat_id'
  | 'notify_on_lead'
  | 'notify_on_emergency'
  | 'notify_on_general_inquiry'
  | 'notify_sms_enabled'
  | 'notify_whatsapp_enabled'
  | 'notify_telegram_enabled'
  | 'notify_email_enabled'
  | 'email_address'
> {
  return {
    sms_number: null,
    whatsapp_number: null,
    telegram_chat_id: null,
    notify_on_lead: true,
    notify_on_emergency: true,
    notify_on_general_inquiry: false,
    notify_sms_enabled: true,
    notify_whatsapp_enabled: false,
    notify_telegram_enabled: false,
    // Email channel defaults — must be explicitly enabled in tests
    notify_email_enabled: false,
    email_address: null,
    ...overrides,
  }
}

describe('computeChannels — email channel gating (Phase 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // D-05: shouldSendEmail=true when email_address set + notify_email_enabled=true + intent=lead
  it('shouldSendEmail=true when email_address set, notify_email_enabled=true, intent=lead', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendEmail).toBe(true)
  })

  // D-05: shouldSendEmail=true when email_address set + notify_email_enabled=true + intent=emergency
  it('shouldSendEmail=true when email_address set, notify_email_enabled=true, intent=emergency', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_emergency: true,
    })
    const result = computeChannels(settings, 'emergency')
    expect(result.shouldSendEmail).toBe(true)
  })

  // D-05: shouldSendEmail=false when email_address=null (even with notify_email_enabled=true)
  it('shouldSendEmail=false when email_address=null even with notify_email_enabled=true', () => {
    const settings = makeEmailSettings({
      email_address: null,
      notify_email_enabled: true,
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendEmail).toBe(false)
  })

  // D-05: shouldSendEmail=false when notify_email_enabled=false (even with email_address set)
  it('shouldSendEmail=false when notify_email_enabled=false even with email_address set', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: false,
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendEmail).toBe(false)
  })

  // D-02: info intent without opt-in → shouldSendEmail=false
  it('shouldSendEmail=false when intent=info and notify_on_general_inquiry=false', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_general_inquiry: false,
    })
    const result = computeChannels(settings, 'info')
    expect(result.shouldSendEmail).toBe(false)
  })

  // D-02: info with opt-in → shouldSendEmail=true
  it('shouldSendEmail=true when intent=info, notify_on_general_inquiry=true, email_address set, notify_email_enabled=true', () => {
    const settings = makeEmailSettings({
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_general_inquiry: true,
    })
    const result = computeChannels(settings, 'info')
    expect(result.shouldSendEmail).toBe(true)
  })
})
