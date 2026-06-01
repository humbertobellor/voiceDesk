// tests/components/notification/NotificationSettingsForm.webhook.test.tsx
// Tests for the Telegram Bot Webhook card inside NotificationSettingsForm.
// Plan 15-01, Wave 0 — implementation is complete; @ts-expect-error suppressions removed.
//
// Test ID: 15-W0-03

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Module mocks (Vitest hoisting requirement — before any imports that depend on them) ──

vi.mock('@/app/(dashboard)/settings/notifications/actions', () => ({
  activateTelegramWebhook: vi.fn(),
}))

vi.mock('@/lib/query/client', () => ({
  useNotificationSettings: () => ({ data: undefined, isLoading: false }),
  useUpdateNotificationSettings: () => ({
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
  useTelegramUnlink: () => ({
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('@/contexts/ContractorContext', () => ({
  useContractor: () => ({ contractorId: 'test-contractor-id' }),
}))

// ── Import component under test ──────────────────────────────────────────────
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'
import { activateTelegramWebhook } from '@/app/(dashboard)/settings/notifications/actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
}

// ── Test data ─────────────────────────────────────────────────────────────────

const initialSettings = {
  id: 'ns-test-1',
  contractor_id: 'test-contractor-id',
  sms_number: null,
  whatsapp_number: null,
  notify_sms_enabled: false,
  notify_whatsapp_enabled: false,
  notify_telegram_enabled: false,
  notify_on_lead: true,
  notify_on_emergency: true,
  notify_on_general_inquiry: false,
  email_address: null,
  notify_email_enabled: false,
  telegram_chat_id: null,
  whatsapp_opted_in_at: null,
  notify_on_payment_failure: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockWebhookInfo: WebhookInfo = {
  url: 'https://voicedesk.vercel.app/api/webhooks/telegram',
  has_custom_certificate: false,
  pending_update_count: 0,
}

// ── Describe block ────────────────────────────────────────────────────────────

describe('NotificationSettingsForm webhook card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Test 1 (15-W0-03-a): Heading renders when initialWebhookInfo is null ──
  it('renders "Telegram Bot Webhook" heading when initialWebhookInfo is null', () => {
    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    expect(screen.getByText('Telegram Bot Webhook')).toBeInTheDocument()
  })

  // ── Test 2 (15-W0-03-b): "Not registered" status when initialWebhookInfo is null ──
  it('renders "Not registered" status text when initialWebhookInfo is null', () => {
    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    expect(screen.getByText(/not registered/i)).toBeInTheDocument()
  })

  // ── Test 3 (15-W0-03-c): Registered status shown when initialWebhookInfo has url ──
  it('renders "Registered" status when initialWebhookInfo has url field populated', () => {
    render(
      <NotificationSettingsForm
        initialSettings={initialSettings}
        initialWebhookInfo={mockWebhookInfo}
      />,
    )

    // Expect "Registered" status (WR-01: URL is not shown in client HTML for security)
    expect(screen.getByText('Registered')).toBeInTheDocument()
  })

  // ── Test 4 (15-W0-03-d): Activate button present and enabled by default ───
  it('"Activate Telegram Webhook" button is present and enabled by default', () => {
    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    const button = screen.getByRole('button', { name: /activate telegram webhook/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  // ── Test 5 (15-W0-03-e): Loading state + disabled while action is in-flight ──
  it('button shows loading state and is disabled when clicked (mock activateTelegramWebhook to pend indefinitely)', async () => {
    // Arrange: action never resolves
    vi.mocked(activateTelegramWebhook).mockImplementation(
      () => new Promise(() => {}) as Promise<never>,
    )

    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    const button = screen.getByRole('button', { name: /activate telegram webhook/i })
    fireEvent.click(button)

    // After click, button should be disabled during in-flight request
    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  // ── Test 6 (15-W0-03-f): Status updates to "Registered" after successful activation ───────
  it('status updates to "Registered" after successful activation', async () => {
    // Arrange: action resolves successfully
    vi.mocked(activateTelegramWebhook).mockResolvedValue({
      ok: true,
      webhookInfo: {
        url: 'https://voicedesk.vercel.app/api/webhooks/telegram',
        has_custom_certificate: false,
        pending_update_count: 0,
      },
    })

    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    const button = screen.getByRole('button', { name: /activate telegram webhook/i })
    fireEvent.click(button)

    // After success, status should show "Registered" (WR-01: URL hidden in client HTML)
    await waitFor(() => {
      expect(screen.getByText('Registered')).toBeInTheDocument()
    })
  })

  // ── Test 7 (15-W0-03-g): Inline error when server action returns error ────
  it('inline error displayed below button when server action returns { ok: false, error: "Test error" }', async () => {
    // Arrange: action returns an error
    vi.mocked(activateTelegramWebhook).mockResolvedValue({
      ok: false,
      error: 'Test error',
    })

    render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

    const button = screen.getByRole('button', { name: /activate telegram webhook/i })
    fireEvent.click(button)

    // Inline error should appear below the button
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Test error')
    })
  })
})
