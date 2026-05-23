// src/app/api/notification-settings/route.ts
// PATCH — updates notification settings for the authenticated contractor.
//
// IDOR guard: contractor_id is ALWAYS derived from getUser() session.
// The request body MUST NOT contain contractor_id — it is ignored if present.
//
// Phone normalization: sms_number and whatsapp_number are normalized to E.164
// using libphonenumber-js with 'US' default region. Non-null invalid input → 422.
//
// Threat mitigations:
//   T-10-01 (Elevation of Privilege): contractor_id from session, never from body
//   T-10-02 (Tampering): E.164 normalization before DB write; invalid → 422
//   T-10-04 (NULL contractor_id): getUser() null → 401 before any DB access
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Zod schema for the PATCH request body. All 8 notification settings fields. */
const updateNotificationSettingsSchema = z.object({
  sms_number: z.string().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
  notify_sms_enabled: z.boolean().optional(),
  notify_whatsapp_enabled: z.boolean().optional(),
  notify_telegram_enabled: z.boolean().optional(),
  notify_on_lead: z.boolean().optional(),
  notify_on_emergency: z.boolean().optional(),
  notify_on_general_inquiry: z.boolean().optional(),
})

/**
 * Normalizes a phone number string to E.164 format using 'US' as the default region.
 *
 * @param input - Raw phone number string, or null to clear the field.
 * @returns E.164 formatted number (e.g. '+13055551234'), or null if input is null.
 * @throws {Error} If input is a non-null string that is not a valid US phone number.
 */
function normalizePhoneNumber(input: string | null | undefined): string | null | undefined {
  if (input === null || input === undefined) return input
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!isValidPhoneNumber(trimmed, 'US')) {
    throw new Error('invalid')
  }
  return parsePhoneNumber(trimmed, 'US').format('E.164')
}

/**
 * PATCH /api/notification-settings
 *
 * Updates all notification settings for the authenticated contractor.
 * Phone numbers are validated and normalized to E.164 before persistence.
 * contractor_id is derived from the authenticated session (never from request body).
 *
 * @param req - Next.js Request containing JSON body with up to 8 notification fields.
 * @returns 200 with updated NotificationSettings row, or 401/404/422 on errors.
 */
export async function PATCH(req: Request) {
  // 1. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup — use service role to bypass RLS for the join
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    if (loadErr) console.error('[notification-settings] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // 3. Parse and validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = updateNotificationSettingsSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parseResult.error.flatten() }, { status: 422 })
  }

  const updates = parseResult.data

  // 4. Phone normalization — validate and normalize to E.164
  let normalizedSms: string | null | undefined
  let normalizedWhatsapp: string | null | undefined

  try {
    normalizedSms = normalizePhoneNumber(updates.sms_number)
  } catch {
    return NextResponse.json(
      { error: 'Invalid SMS number: enter a valid US phone number' },
      { status: 422 }
    )
  }

  try {
    normalizedWhatsapp = normalizePhoneNumber(updates.whatsapp_number)
  } catch {
    return NextResponse.json(
      { error: 'Invalid WhatsApp number: enter a valid US phone number' },
      { status: 422 }
    )
  }

  // 5. Build the update payload — only include fields that were provided
  // contractor_id comes from session (IDOR guard: never from body)
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (normalizedSms !== undefined) updatePayload.sms_number = normalizedSms
  if (normalizedWhatsapp !== undefined) updatePayload.whatsapp_number = normalizedWhatsapp
  if (updates.notify_sms_enabled !== undefined) updatePayload.notify_sms_enabled = updates.notify_sms_enabled
  if (updates.notify_whatsapp_enabled !== undefined) updatePayload.notify_whatsapp_enabled = updates.notify_whatsapp_enabled
  if (updates.notify_telegram_enabled !== undefined) updatePayload.notify_telegram_enabled = updates.notify_telegram_enabled
  if (updates.notify_on_lead !== undefined) updatePayload.notify_on_lead = updates.notify_on_lead
  if (updates.notify_on_emergency !== undefined) updatePayload.notify_on_emergency = updates.notify_on_emergency
  if (updates.notify_on_general_inquiry !== undefined) updatePayload.notify_on_general_inquiry = updates.notify_on_general_inquiry

  // 6. DB write — filter by contractor.id from session (defense-in-depth with RLS)
  const { data, error: updateErr } = await serviceClient
    .from('notification_settings')
    .update(updatePayload)
    .eq('contractor_id', contractor.id)
    .select()
    .single()

  if (updateErr) {
    console.error('[notification-settings] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}
