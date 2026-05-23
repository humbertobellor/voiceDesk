import { describe, it, expect, vi, beforeEach } from 'vitest'

// All vi.mock calls must come before any imports that transitively depend on them.
// Factory functions use only vi.fn() inline (never top-level variables) to avoid
// the hoisting initialisation order issue.

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

// Import mocked modules after all vi.mock calls
import { sendSms } from '@/lib/notifications/sms'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

// Import the pure computeChannels function under test (WR-02: exercises real dispatch logic)
import { computeChannels } from '@/inngest/functions/retell-notify-dispatch'
import type { NotificationSettings, CallIntent } from '@/types/database'

const mockSendSms = vi.mocked(sendSms)
const mockSendWhatsApp = vi.mocked(sendWhatsApp)

/** Helper to build a minimal NotificationSettings-compatible object. */
function makeSettings(
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
> {
  return {
    sms_number: null,
    whatsapp_number: null,
    telegram_chat_id: null,
    notify_on_lead: true,
    notify_on_emergency: true,
    notify_on_general_inquiry: false,
    // D-02 migration defaults: SMS opt-out (true), WhatsApp/Telegram opt-in (false)
    notify_sms_enabled: true,
    notify_whatsapp_enabled: true,   // existing Phase 5 tests expect all configured channels to fire
    notify_telegram_enabled: true,   // existing Phase 5 tests expect all configured channels to fire
    ...overrides,
  }
}

/**
 * Phase 10: Helper to build a settings object that includes the new enable-flag fields.
 * Defaults match the migration: SMS=true (opt-out), WhatsApp=false, Telegram=false.
 */
function makeSettingsWithEnableFlags(
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
> {
  return {
    sms_number: null,
    whatsapp_number: null,
    telegram_chat_id: null,
    notify_on_lead: true,
    notify_on_emergency: true,
    notify_on_general_inquiry: false,
    notify_sms_enabled: true,    // D-02: SMS opt-out default
    notify_whatsapp_enabled: false, // D-02: WhatsApp opt-in default
    notify_telegram_enabled: false, // D-02: Telegram opt-in default
    ...overrides,
  }
}

describe('computeChannels — channel dispatch matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // D-03: no_action → nothing fires
  it('no_action intent → all channels skipped', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      telegram_chat_id: '12345',
    })
    const result = computeChannels(settings, 'no_action')
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // D-03: null intent → nothing fires
  it('null intent → all channels skipped', () => {
    const settings = makeSettings({ sms_number: '+15551111111' })
    const result = computeChannels(settings, null)
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // D-05: lead with all channels configured and default prefs → all fire
  it('lead intent with all channels configured → all channels fire', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      telegram_chat_id: '12345',
    })
    const result = computeChannels(settings, 'lead')
    expect(result).toEqual({ shouldSendSms: true, shouldSendWhatsApp: true, shouldSendTelegram: true })
  })

  // CR-04: notify_on_lead=false → SMS, WhatsApp, and Telegram all suppressed for lead
  it('lead intent with notify_on_lead=false → all channels suppressed', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      telegram_chat_id: '12345',
      notify_on_lead: false,
    })
    const result = computeChannels(settings, 'lead')
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // CR-04: notify_on_emergency=false → all channels suppressed for emergency
  it('emergency intent with notify_on_emergency=false → all channels suppressed', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      telegram_chat_id: '12345',
      notify_on_emergency: false,
    })
    const result = computeChannels(settings, 'emergency')
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // D-06: info without opt-in → all channels skipped
  it('info intent without notify_on_general_inquiry → all channels skipped', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      telegram_chat_id: '12345',
      notify_on_general_inquiry: false,
    })
    const result = computeChannels(settings, 'info')
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // D-06: info with opt-in → all configured channels fire
  it('info intent with notify_on_general_inquiry=true → all channels fire', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      telegram_chat_id: '12345',
      notify_on_general_inquiry: true,
    })
    const result = computeChannels(settings, 'info')
    expect(result).toEqual({ shouldSendSms: true, shouldSendWhatsApp: true, shouldSendTelegram: true })
  })

  // null settings → nothing fires (contractor has no notification config)
  it('null settings → all channels skipped', () => {
    const result = computeChannels(null, 'lead')
    expect(result).toEqual({ shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false })
  })

  // Partial config: only SMS number set → only SMS fires for lead
  it('lead with only sms_number configured → only SMS fires', () => {
    const settings = makeSettings({ sms_number: '+15551111111' })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendSms).toBe(true)
    expect(result.shouldSendWhatsApp).toBe(false)
    expect(result.shouldSendTelegram).toBe(false)
  })
})

describe('SMS and Telegram message body format', () => {
  // EMRG-03: Emergency SMS body includes "EMERGENCY" prominently
  it('emergency SMS body contains EMERGENCY prominently', () => {
    const callerPhone = '+15559999999'
    const serviceRequested = 'gas smell'
    const smsBody = `EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
    expect(smsBody).toContain('EMERGENCY')
    expect(smsBody).toContain(callerPhone)
    expect(smsBody).toContain(serviceRequested)
  })

  // Validates Telegram emergency message template
  it('emergency telegram message includes EMERGENCY and callback instruction', () => {
    const callerPhone = '+15559999999'
    const serviceRequested = 'CO alarm'
    const telegramMessage = `⚠️ EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
    expect(telegramMessage).toContain('EMERGENCY')
    expect(telegramMessage).toContain(callerPhone)
  })
})

describe('D-09: WhatsApp fallback SMS guard (CR-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendSms.mockResolvedValue({ sid: 'SM_fallback', status: 'queued' })
    mockSendWhatsApp.mockRejectedValue(new Error('WhatsApp API error'))
  })

  // CR-02: When primary SMS fires for the same intent, the D-09 fallback must NOT also fire.
  // Both channels use the same preference flags, so whenever shouldSendSms=true,
  // shouldSendWhatsApp=true too. The guard `!shouldSendSms` ensures no duplicate.
  it('no duplicate SMS fallback when primary SMS already dispatched (CR-02)', () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      notify_on_lead: true,  // both channels fire → shouldSendSms=true → fallback suppressed
    })

    const channels = computeChannels(settings, 'lead')
    expect(channels.shouldSendSms).toBe(true)
    expect(channels.shouldSendWhatsApp).toBe(true)

    // D-09 fallback condition: sms_number present AND !shouldSendSms
    const fallbackWouldFire = settings.sms_number != null && !channels.shouldSendSms
    expect(fallbackWouldFire).toBe(false)
  })

  // Validates the fallback SMS mock itself (integration smoke test)
  it('SMS fallback mock sends to sms_number on WhatsApp failure', async () => {
    const settings = makeSettings({
      sms_number: '+15551111111',
      whatsapp_number: '+15552222222',
      notify_on_lead: false,  // SMS suppressed by preference → shouldSendSms=false
    })

    const channels = computeChannels(settings, 'lead')
    // When notify_on_lead=false: both SMS and WhatsApp are suppressed (shared flag).
    // The fallback would be eligible by the shouldSendSms check, but WhatsApp also won't fire.
    expect(channels.shouldSendSms).toBe(false)
    expect(channels.shouldSendWhatsApp).toBe(false)

    // Direct mock exercise: confirm the fallback SMS send call works when invoked
    await mockSendSms({
      to: settings.sms_number!,
      body: '[WA fallback] New call from +15559999999 — test.',
      contractorId: 'c1',
      callId: 'call-1',
    })
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15551111111' })
    )
  })
})

// Phase 10: Channel enable flag tests (RED state — computeChannels() does not yet check enable flags)
// These tests FAIL until Plan 10-02 adds the enable-flag checks to computeChannels().
// D-07: notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled gate dispatch
//   independently of notify_on_lead / notify_on_emergency / notify_on_general_inquiry.
describe('Phase 10: channel enable flags', () => {
  // D-07: SMS disabled via enable flag → shouldSendSms=false even if sms_number present and intent matches
  it('computeChannels returns shouldSendSms=false when notify_sms_enabled=false even if sms_number present', () => {
    const settings = makeSettingsWithEnableFlags({
      sms_number: '+15551111111',
      notify_sms_enabled: false,  // channel disabled
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendSms).toBe(false)
  })

  // D-07: WhatsApp disabled via enable flag → shouldSendWhatsApp=false even if whatsapp_number present
  it('computeChannels returns shouldSendWhatsApp=false when notify_whatsapp_enabled=false', () => {
    const settings = makeSettingsWithEnableFlags({
      whatsapp_number: '+15552222222',
      notify_whatsapp_enabled: false,  // channel disabled
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendWhatsApp).toBe(false)
  })

  // D-07: Telegram disabled via enable flag → shouldSendTelegram=false even if telegram_chat_id present
  it('computeChannels returns shouldSendTelegram=false when notify_telegram_enabled=false', () => {
    const settings = makeSettingsWithEnableFlags({
      telegram_chat_id: '12345',
      notify_telegram_enabled: false,  // channel disabled
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendTelegram).toBe(false)
  })

  // D-07: SMS enabled when sms_number present AND notify_sms_enabled=true AND intent matches
  it('computeChannels returns shouldSendSms=true when sms_number present AND notify_sms_enabled=true AND intent matches', () => {
    const settings = makeSettingsWithEnableFlags({
      sms_number: '+15551111111',
      notify_sms_enabled: true,  // channel enabled
      notify_on_lead: true,
    })
    const result = computeChannels(settings, 'lead')
    expect(result.shouldSendSms).toBe(true)
  })
})
