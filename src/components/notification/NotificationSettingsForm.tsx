'use client'

/**
 * NotificationSettingsForm — client component for the settings/notifications page.
 *
 * Manages all notification delivery preferences: SMS, WhatsApp, Telegram channel
 * configuration and per-event-type toggles. Phone numbers are validated on submit
 * and normalized to E.164 before being sent to the API.
 *
 * Props:
 *   initialSettings — passed from the Server Component; used to seed form state
 *                     before the React Query hydration completes.
 */

import { useState, useEffect, useRef } from 'react'
import { parsePhoneNumber } from 'libphonenumber-js'
import { MessageSquare, MessageCircle, Send, Loader2, Mail, Bot } from 'lucide-react'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useTelegramUnlink,
} from '@/lib/query/client'
import { useContractor } from '@/contexts/ContractorContext'
import { activateTelegramWebhook } from '@/app/(dashboard)/settings/notifications/actions'
import type { NotificationSettings } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationSettingsFormProps {
  /** Server-fetched initial settings; prevents layout shift before query resolves. */
  initialSettings: NotificationSettings
  /**
   * Telegram webhook status fetched by the Server Component on page load (D-07).
   * Null when TELEGRAM_BOT_TOKEN is missing or getWebhookInfo() fails (D-08).
   * Uses Record<string, unknown> to avoid importing grammy types into a client component.
   */
  initialWebhookInfo: Record<string, unknown> | null
}

interface FormData {
  sms_number: string
  whatsapp_number: string
  notify_sms_enabled: boolean
  notify_whatsapp_enabled: boolean
  notify_telegram_enabled: boolean
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean
  email_address: string
  notify_email_enabled: boolean
}

interface PhoneErrors {
  sms_number?: string
  whatsapp_number?: string
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a NotificationSettings record into FormData state shape.
 * Null phone values become empty strings for controlled inputs.
 */
function settingsToFormData(s: NotificationSettings): FormData {
  return {
    sms_number: s.sms_number ?? '',
    whatsapp_number: s.whatsapp_number ?? '',
    notify_sms_enabled: s.notify_sms_enabled,
    notify_whatsapp_enabled: s.notify_whatsapp_enabled,
    notify_telegram_enabled: s.notify_telegram_enabled,
    notify_on_lead: s.notify_on_lead,
    notify_on_emergency: s.notify_on_emergency,
    notify_on_general_inquiry: s.notify_on_general_inquiry,
    email_address: s.email_address ?? '',
    notify_email_enabled: s.notify_email_enabled,
  }
}

/**
 * Validates and normalizes a phone number string.
 *
 * @returns The E.164 formatted string on success, `null` for empty input
 *          (indicating the user wants to clear the field), or throws an
 *          error message string if the number is non-empty but invalid.
 */
function normalizePhone(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null

  try {
    const parsed = parsePhoneNumber(trimmed, 'US')
    if (!parsed.isValid()) {
      throw new Error('invalid')
    }
    return parsed.format('E.164')
  } catch {
    throw new Error('Enter a valid US phone number (e.g. +1 305 555 1234).')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationSettingsForm({
  initialSettings,
  initialWebhookInfo,
}: NotificationSettingsFormProps) {
  const { contractorId } = useContractor()
  const { data: liveSettings } = useNotificationSettings()
  const updateSettings = useUpdateNotificationSettings()
  const telegramUnlink = useTelegramUnlink()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>(settingsToFormData(initialSettings))
  const [phoneErrors, setPhoneErrors] = useState<PhoneErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [unlinkLoading, setUnlinkLoading] = useState(false)
  const [telegramError, setTelegramError] = useState<string | null>(null)

  // ── Webhook activation state (D-09) ──────────────────────────────────────
  const [webhookInfo, setWebhookInfo] = useState<Record<string, unknown> | null>(initialWebhookInfo)
  const [webhookActivating, setWebhookActivating] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(null)

  // Refs for focusing invalid phone fields on submit
  const smsInputRef = useRef<HTMLInputElement>(null)
  const whatsappInputRef = useRef<HTMLInputElement>(null)

  // ── Sync from live query (after successful unlink or background refresh) ───
  useEffect(() => {
    if (liveSettings) {
      setFormData(settingsToFormData(liveSettings))
    }
  }, [liveSettings])

  // ── Derive Telegram connection state ─────────────────────────────────────
  // Prefer live query data; fall back to initialSettings on first render.
  const effectiveSettings = liveSettings ?? initialSettings
  const telegramConnected = effectiveSettings.telegram_chat_id != null

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFieldChange<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    // Clear phone errors as the user edits (error was set on prior submit)
    if (key === 'sms_number' || key === 'whatsapp_number') {
      setPhoneErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    // ── Phone validation ───────────────────────────────────────────────────
    const newErrors: PhoneErrors = {}
    let smsE164: string | null = null
    let waE164: string | null = null

    try {
      smsE164 = normalizePhone(formData.sms_number)
    } catch (err) {
      newErrors.sms_number = (err as Error).message
    }

    try {
      waE164 = normalizePhone(formData.whatsapp_number)
    } catch (err) {
      newErrors.whatsapp_number = (err as Error).message
    }

    if (Object.keys(newErrors).length > 0) {
      setPhoneErrors(newErrors)
      // Focus the first invalid field
      if (newErrors.sms_number) {
        smsInputRef.current?.focus()
      } else if (newErrors.whatsapp_number) {
        whatsappInputRef.current?.focus()
      }
      return
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    setIsSaving(true)
    try {
      await updateSettings.mutateAsync({
        sms_number: smsE164,
        whatsapp_number: waE164,
        notify_sms_enabled: formData.notify_sms_enabled,
        notify_whatsapp_enabled: formData.notify_whatsapp_enabled,
        notify_telegram_enabled: formData.notify_telegram_enabled,
        notify_on_lead: formData.notify_on_lead,
        notify_on_emergency: formData.notify_on_emergency,
        notify_on_general_inquiry: formData.notify_on_general_inquiry,
        email_address: formData.email_address.trim() || null,
        notify_email_enabled: formData.notify_email_enabled,
      })
      setFeedback({ type: 'success', message: 'Settings saved.' })
      // Auto-dismiss success banner after 3 s
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to save settings. Please try again.'
      setFeedback({ type: 'error', message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnlinkTelegram = async () => {
    setTelegramError(null)
    setUnlinkLoading(true)
    try {
      await telegramUnlink.mutateAsync()
      // Disable the local toggle immediately (query cache invalidation follows)
      setFormData((prev) => ({ ...prev, notify_telegram_enabled: false }))
    } catch {
      setTelegramError('Could not unlink Telegram. Please try again.')
    } finally {
      setUnlinkLoading(false)
    }
  }

  /**
   * Registers the Telegram webhook via the server action (TEL-02, D-10).
   * Mirrors handleUnlinkTelegram: clear error → set loading → call action → update state.
   * Never throws — server action returns discriminated union.
   */
  const handleActivateTelegramWebhook = async () => {
    setWebhookError(null)
    setWebhookActivating(true)
    try {
      const result = await activateTelegramWebhook()
      if (result.ok) {
        setWebhookInfo(result.webhookInfo)
      } else {
        setWebhookError(result.error)
      }
    } finally {
      setWebhookActivating(false)
    }
  }

  /** Truncates a URL to 45 chars with ellipsis for display in the status row. */
  const truncatedUrl = (url: string) => (url.length > 45 ? url.slice(0, 45) + '…' : url)

  // ── Shared CSS fragments ───────────────────────────────────────────────────

  const cardClass =
    'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'

  const inputClass =
    'w-full px-4 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F8FAFC] text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent ' +
    'placeholder:text-[#64748B] disabled:opacity-50 disabled:cursor-not-allowed'

  const checkboxClass = 'w-4 h-4 accent-[#F97316]'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Section 0: Email ─────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">Email Notifications</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer" htmlFor="notify_email_enabled">
            <span className="text-sm text-[#94A3B8]">Enable email alerts</span>
            <input
              id="notify_email_enabled"
              type="checkbox"
              className={checkboxClass}
              checked={formData.notify_email_enabled}
              onChange={(e) => handleFieldChange('notify_email_enabled', e.target.checked)}
            />
          </label>
        </div>
        <input
          type="email"
          value={formData.email_address}
          onChange={(e) => handleFieldChange('email_address', e.target.value)}
          placeholder="your@email.com"
          aria-label="Email address"
          className={inputClass}
          disabled={!formData.notify_email_enabled}
        />
      </div>

      {/* ── Section 1: SMS ───────────────────────────────────────────────── */}
      <div className={cardClass}>
        {/* Card header: icon + label + enable checkbox */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">SMS</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer" htmlFor="notify_sms_enabled">
            <span className="text-sm text-[#94A3B8]">Send SMS notifications</span>
            <input
              id="notify_sms_enabled"
              type="checkbox"
              className={checkboxClass}
              checked={formData.notify_sms_enabled}
              onChange={(e) => handleFieldChange('notify_sms_enabled', e.target.checked)}
            />
          </label>
        </div>

        {/* SMS number input */}
        <div>
          <label htmlFor="sms_number" className="block text-sm font-semibold text-gray-300 mb-2">
            SMS number
          </label>
          <input
            ref={smsInputRef}
            id="sms_number"
            name="sms_number"
            type="tel"
            inputMode="tel"
            placeholder="+1 (305) 555-1234"
            value={formData.sms_number}
            onChange={(e) => handleFieldChange('sms_number', e.target.value)}
            disabled={!formData.notify_sms_enabled}
            className={inputClass}
            aria-describedby={phoneErrors.sms_number ? 'sms_number_error' : undefined}
          />
          {phoneErrors.sms_number && (
            <p
              id="sms_number_error"
              role="alert"
              className="mt-2 text-sm text-[#EF4444]"
            >
              {phoneErrors.sms_number}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 2: WhatsApp ───────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">WhatsApp</span>
          </div>
          <label
            className="flex items-center gap-2 cursor-pointer"
            htmlFor="notify_whatsapp_enabled"
          >
            <span className="text-sm text-[#94A3B8]">Send WhatsApp notifications</span>
            <input
              id="notify_whatsapp_enabled"
              type="checkbox"
              className={checkboxClass}
              checked={formData.notify_whatsapp_enabled}
              onChange={(e) => handleFieldChange('notify_whatsapp_enabled', e.target.checked)}
            />
          </label>
        </div>

        <div>
          <label
            htmlFor="whatsapp_number"
            className="block text-sm font-semibold text-gray-300 mb-2"
          >
            WhatsApp number
          </label>
          <input
            ref={whatsappInputRef}
            id="whatsapp_number"
            name="whatsapp_number"
            type="tel"
            inputMode="tel"
            placeholder="+1 (305) 555-1234"
            value={formData.whatsapp_number}
            onChange={(e) => handleFieldChange('whatsapp_number', e.target.value)}
            disabled={!formData.notify_whatsapp_enabled}
            className={inputClass}
            aria-describedby={phoneErrors.whatsapp_number ? 'whatsapp_number_error' : undefined}
          />
          {phoneErrors.whatsapp_number && (
            <p
              id="whatsapp_number_error"
              role="alert"
              className="mt-2 text-sm text-[#EF4444]"
            >
              {phoneErrors.whatsapp_number}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 3: Telegram ───────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">Telegram</span>
          </div>
          <label
            className="flex items-center gap-2 cursor-pointer"
            htmlFor="notify_telegram_enabled"
          >
            <span className="text-sm text-[#94A3B8]">Send Telegram notifications</span>
            <input
              id="notify_telegram_enabled"
              type="checkbox"
              className={checkboxClass}
              checked={formData.notify_telegram_enabled}
              onChange={(e) => handleFieldChange('notify_telegram_enabled', e.target.checked)}
            />
          </label>
        </div>

        {telegramConnected ? (
          /* Connected state */
          <div>
            <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-lg p-3 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] flex-shrink-0" />
                <span>Telegram connected</span>
              </div>
              <button
                type="button"
                onClick={handleUnlinkTelegram}
                disabled={unlinkLoading}
                aria-label="Unlink Telegram account"
                aria-disabled={unlinkLoading}
                className="border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10 px-4 py-2 rounded-lg text-sm min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {unlinkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Unlink Telegram'
                )}
              </button>
            </div>
            {telegramError && (
              <p role="alert" className="mt-2 text-sm text-[#EF4444]">
                {telegramError}
              </p>
            )}
          </div>
        ) : (
          /* Not-connected state */
          <div className="bg-[#1E3A5F]/40 border border-[#3B82F6]/30 text-[#93C5FD] rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Connect your Telegram account</p>
            <p className="mb-2">
              Tap the link below to start a chat with the VoiceDesk bot. Once you send /start,
              your account will be linked automatically.
            </p>
            <a
              href={`https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#F97316] underline hover:opacity-80 transition-opacity"
            >
              Open @voiceDeskTelBot (opens in new tab)
            </a>
          </div>
        )}
      </div>

      {/* ── Telegram Bot Webhook card (D-01, D-02) ─────────────────────── */}
      <div className={cardClass}>
        {/* Card header */}
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-[#64748B]" />
          <span className="text-sm font-semibold text-[#F8FAFC]">Telegram Bot Webhook</span>
        </div>

        {/* Webhook status row */}
        <div className="flex items-center justify-between py-3 mb-4">
          <span className="text-sm text-[#94A3B8]">Webhook status</span>
          {webhookInfo &&
          typeof webhookInfo.url === 'string' &&
          webhookInfo.url.length > 0 ? (
            <span className="text-sm text-[#F8FAFC] font-mono">
              {truncatedUrl(webhookInfo.url as string)}
            </span>
          ) : (
            <span className="text-sm text-[#94A3B8]">Not registered</span>
          )}
        </div>

        {/* Activate button (D-10) */}
        <button
          type="button"
          onClick={handleActivateTelegramWebhook}
          disabled={webhookActivating}
          className="bg-[#F97316] hover:bg-[#F97316]/90 text-[#0F172A] text-sm font-semibold px-6 py-2 rounded-lg min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {webhookActivating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Activating…
            </>
          ) : (
            'Activate Telegram Webhook'
          )}
        </button>

        {/* Inline error (D-06) */}
        {webhookError && (
          <p role="alert" className="mt-2 text-sm text-[#EF4444]">
            {webhookError}
          </p>
        )}
      </div>

      {/* ── Section 4: Event type toggles ─────────────────────────────────── */}
      <div className={cardClass}>
        <p className="text-sm font-semibold text-[#F8FAFC] mb-2">Notify me about</p>

        {/* New leads */}
        <div className="flex items-center justify-between py-3 border-b border-[#334155]">
          <label htmlFor="notify_on_lead" className="text-sm text-[#F8FAFC] cursor-pointer">
            New leads
          </label>
          <input
            id="notify_on_lead"
            type="checkbox"
            className={checkboxClass}
            checked={formData.notify_on_lead}
            onChange={(e) => handleFieldChange('notify_on_lead', e.target.checked)}
          />
        </div>

        {/* Emergencies */}
        <div className="flex items-center justify-between py-3 border-b border-[#334155]">
          <label htmlFor="notify_on_emergency" className="text-sm text-[#F8FAFC] cursor-pointer">
            Emergencies
          </label>
          <input
            id="notify_on_emergency"
            type="checkbox"
            className={checkboxClass}
            checked={formData.notify_on_emergency}
            onChange={(e) => handleFieldChange('notify_on_emergency', e.target.checked)}
          />
        </div>

        {/* General inquiries */}
        <div className="flex items-center justify-between py-3">
          <label
            htmlFor="notify_on_general_inquiry"
            className="text-sm text-[#F8FAFC] cursor-pointer"
          >
            General inquiries
          </label>
          <input
            id="notify_on_general_inquiry"
            type="checkbox"
            className={checkboxClass}
            checked={formData.notify_on_general_inquiry}
            onChange={(e) => handleFieldChange('notify_on_general_inquiry', e.target.checked)}
          />
        </div>
      </div>

      {/* ── Feedback banner ───────────────────────────────────────────────── */}
      {feedback?.type === 'success' && (
        <div
          role="status"
          className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-lg p-3 text-sm mb-4 max-w-[480px]"
        >
          {feedback.message}
        </div>
      )}
      {feedback?.type === 'error' && (
        <div
          role="alert"
          className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4 max-w-[480px]"
        >
          {feedback.message}
        </div>
      )}

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isSaving}
        aria-disabled={isSaving}
        className="bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          'Save Settings'
        )}
      </button>
    </form>
  )
}
