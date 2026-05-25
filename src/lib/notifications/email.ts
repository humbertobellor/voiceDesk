import 'server-only'
import { Resend } from 'resend'

/**
 * Parameters for sending a transactional email via Resend.
 *
 * @property to - Recipient email address.
 * @property subject - Email subject line.
 * @property html - HTML email body string.
 */
export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

/**
 * Result of a sendEmail() call.
 *
 * Never throws — failures are returned as { success: false, error: string }
 * so Inngest functions can inspect the result and decide retry behaviour.
 *
 * @property success - Whether the email was accepted by Resend.
 * @property messageId - Resend message ID on success.
 * @property error - Error message on failure.
 */
export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Email transport function — sends a transactional email via the Resend API.
 *
 * This is a transport-only layer: it accepts a pre-rendered HTML body and
 * returns a typed result. It never throws. Callers (Phase 13 Inngest functions)
 * are responsible for:
 *   - Building the HTML body (templates are Phase 13)
 *   - Checking notification_settings gates before calling
 *   - Inspecting the result and triggering retries on failure
 *
 * Environment variables required:
 *   - RESEND_API_KEY — server-only secret; never NEXT_PUBLIC_ prefixed
 *   - RESEND_FROM_ADDRESS — verified sending domain (e.g. noreply@voicedesk.app)
 *
 * @param params - { to, subject, html }
 * @returns { success, messageId?, error? } — never throws
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESEND_FROM_ADDRESS

  if (!apiKey || !fromAddress) {
    return {
      success: false,
      error: 'Resend credentials not configured (RESEND_API_KEY or RESEND_FROM_ADDRESS missing)',
    }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (result.error) {
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
