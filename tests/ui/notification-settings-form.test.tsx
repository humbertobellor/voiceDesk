// tests/ui/notification-settings-form.test.tsx
// Phase 10 RED: Wave 0 test stubs for NotificationSettingsForm component.
// All tests throw 'not yet implemented' — implementation added in a later wave.
// Stubs cover: phone number inputs, channel enable toggles, Telegram status, form submission.
import { describe, it } from 'vitest'

// Import will fail until NotificationSettingsForm is created (Wave 1) — intentional RED state.
// vi.mock not used here; the module import itself signals the missing implementation.
// import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'

describe('NotificationSettingsForm', () => {
  it('renders phone number inputs with placeholder "+1 (305) 555-1234"', () => {
    throw new Error('not yet implemented')
  })

  it('shows inline error for invalid phone number on submit', () => {
    throw new Error('not yet implemented')
  })

  it('disables SMS input when notify_sms_enabled toggle is OFF', () => {
    throw new Error('not yet implemented')
  })

  it('disables WhatsApp input when notify_whatsapp_enabled toggle is OFF', () => {
    throw new Error('not yet implemented')
  })

  it('shows "Connected" state when telegram_chat_id is non-null', () => {
    throw new Error('not yet implemented')
  })

  it('shows "Not connected" and deep-link when telegram_chat_id is null', () => {
    throw new Error('not yet implemented')
  })

  it('calls updateSettings mutation with all fields on form submit', () => {
    throw new Error('not yet implemented')
  })
})
