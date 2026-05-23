/**
 * tests/ui/notification-settings-form.test.tsx
 * Phase 10 GREEN: NotificationSettingsForm component tests.
 *
 * Tests cover: phone inputs, channel enable toggles, Telegram connection states,
 * form submission with validation, and Telegram unlink behaviour.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'
import type { NotificationSettings } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

/** Mock React Query hooks so tests do not need a real QueryClient or network. */
const mockMutateAsync = vi.fn()
const mockUnlinkMutateAsync = vi.fn()

vi.mock('@/lib/query/client', () => ({
  useNotificationSettings: () => ({ data: undefined, isLoading: false }),
  useUpdateNotificationSettings: () => ({
    mutateAsync: mockMutateAsync,
    isLoading: false,
  }),
  useTelegramUnlink: () => ({
    mutateAsync: mockUnlinkMutateAsync,
    isLoading: false,
  }),
}))

/** ContractorContext — provide a fixed contractor ID for deep-link tests. */
vi.mock('@/contexts/ContractorContext', () => ({
  useContractor: () => ({ contractorId: 'contractor-abc-123' }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Test data factories
// ─────────────────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    id: 'ns-1',
    contractor_id: 'contractor-abc-123',
    sms_number: null,
    whatsapp_number: null,
    telegram_chat_id: null,
    notify_on_lead: true,
    notify_on_emergency: true,
    notify_on_general_inquiry: false,
    notify_sms_enabled: true,
    notify_whatsapp_enabled: false,
    notify_telegram_enabled: false,
    whatsapp_opted_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function renderForm(settings: NotificationSettings) {
  return render(<NotificationSettingsForm initialSettings={settings} />)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('NotificationSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutateAsync.mockResolvedValue(makeSettings())
    mockUnlinkMutateAsync.mockResolvedValue(makeSettings({ telegram_chat_id: null }))
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders phone number inputs with placeholder "+1 (305) 555-1234"', () => {
    renderForm(makeSettings())

    // Both SMS and WhatsApp inputs share the same placeholder — query individually by id.
    const smsInput = document.getElementById('sms_number') as HTMLInputElement
    expect(smsInput).toBeInTheDocument()
    expect(smsInput.placeholder).toBe('+1 (305) 555-1234')
    expect(smsInput).toHaveAttribute('type', 'tel')

    const waInput = document.getElementById('whatsapp_number') as HTMLInputElement
    expect(waInput).toBeInTheDocument()
    expect(waInput.placeholder).toBe('+1 (305) 555-1234')
    expect(waInput).toHaveAttribute('type', 'tel')
  })

  it('disables SMS input when notify_sms_enabled toggle is OFF', () => {
    renderForm(makeSettings({ notify_sms_enabled: false }))

    const smsInput = screen.getByRole('textbox', { name: /sms number/i })
    expect(smsInput).toBeDisabled()
  })

  it('disables WhatsApp input when notify_whatsapp_enabled toggle is OFF', () => {
    renderForm(makeSettings({ notify_whatsapp_enabled: false }))

    const waInput = screen.getByRole('textbox', { name: /whatsapp number/i })
    expect(waInput).toBeDisabled()
  })

  it('shows "Connected" state when telegram_chat_id is non-null', () => {
    renderForm(makeSettings({ telegram_chat_id: 'chat-999', notify_telegram_enabled: true }))

    expect(screen.getByText('Telegram connected')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /unlink telegram account/i }),
    ).toBeInTheDocument()
  })

  it('shows "Not connected" and deep-link when telegram_chat_id is null', () => {
    renderForm(makeSettings({ telegram_chat_id: null }))

    expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /open @voicedesktelbot/i })
    expect(link).toHaveAttribute(
      'href',
      'https://t.me/voiceDeskTelBot?start=contractor-abc-123',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  // ── Phone validation ───────────────────────────────────────────────────────

  it('shows inline error for invalid phone number on submit', async () => {
    renderForm(makeSettings({ notify_sms_enabled: true }))

    // Enter an obviously invalid number
    const smsInput = screen.getByRole('textbox', { name: /sms number/i })
    fireEvent.change(smsInput, { target: { value: 'not-a-phone' } })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    // Inline error should appear below the field
    await waitFor(() => {
      const alert = screen.getByRole('alert', {
        name: (_, el) =>
          el.id === 'sms_number_error' ||
          (el.textContent ?? '').includes('valid US phone number'),
      })
      expect(alert).toBeInTheDocument()
    })

    // Mutation must NOT have been called
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  // ── Form submission ────────────────────────────────────────────────────────

  it('calls updateSettings mutation with all fields on form submit', async () => {
    const settings = makeSettings({
      sms_number: '+13055551234',
      whatsapp_number: '+13055554321',
      notify_sms_enabled: true,
      notify_whatsapp_enabled: true,
      notify_telegram_enabled: false,
      notify_on_lead: true,
      notify_on_emergency: false,
      notify_on_general_inquiry: true,
    })
    renderForm(settings)

    // The inputs are pre-filled from initialSettings via state
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1)
    })

    const payload = mockMutateAsync.mock.calls[0][0] as Partial<NotificationSettings>
    // All 8 mutable fields must be present
    expect(payload).toHaveProperty('sms_number')
    expect(payload).toHaveProperty('whatsapp_number')
    expect(payload).toHaveProperty('notify_sms_enabled')
    expect(payload).toHaveProperty('notify_whatsapp_enabled')
    expect(payload).toHaveProperty('notify_telegram_enabled')
    expect(payload).toHaveProperty('notify_on_lead')
    expect(payload).toHaveProperty('notify_on_emergency')
    expect(payload).toHaveProperty('notify_on_general_inquiry')
  })
})
