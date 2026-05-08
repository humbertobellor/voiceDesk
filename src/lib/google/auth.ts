// src/lib/google/auth.ts
// Token refresh-on-use utility for Google Calendar API. (D-05)
// Called by: src/inngest/functions/retell-call-classify.ts (create-calendar-event step)
//            src/app/api/auth/google/callback/route.ts (via createOAuth2Client only)
// Pattern: reads calendar_credentials, refreshes token if expiry < 5 minutes away,
//          re-encrypts and writes back, returns configured google.calendar client.
// Returns null if no calendar_credentials row exists (D-15: calendar not connected).
// NEVER log access_token, refresh_token, or decrypted values — log only contractorId.
import 'server-only'
import { google } from 'googleapis'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

/** D-05: Refresh buffer — refresh token if expiry is within 5 minutes */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Returns a fully authenticated Google Calendar v3 client for the given contractor.
 * Handles token refresh transparently (D-05):
 *   - If token_expiry > 5 min away: uses existing access_token directly
 *   - If token_expiry <= 5 min away: refreshes, re-encrypts, writes back to DB
 * Returns null if no calendar_credentials row exists for the contractor (D-15).
 *
 * IMPORTANT: errors from refreshAccessToken() are intentionally re-thrown.
 * Inngest retry backoff will call getCalendarClient() again on the next attempt,
 * which will read the freshly-written token from the DB.
 */
export async function getCalendarClient(contractorId: string) {
  const db = createServiceRoleClient()
  const { data: creds, error } = await db
    .from('calendar_credentials')
    .select('access_token, refresh_token, token_expiry, calendar_id')
    .eq('contractor_id', contractorId)
    .maybeSingle()

  if (error) {
    console.error('[google/auth] calendar_credentials read failed for contractor:', contractorId)
    throw new Error(error.message)
  }

  if (!creds) {
    // D-15: no calendar connected — caller must handle null gracefully (set google_sync_status='skipped')
    return null
  }

  const oauth2Client = createOAuth2Client()
  // token_expiry from Supabase is an ISO string — convert to ms for comparison.
  // Treat null/undefined as epoch 0 (already expired) so a refresh is forced immediately.
  const expiryMs = creds.token_expiry != null ? new Date(creds.token_expiry).getTime() : 0
  const needsRefresh = expiryMs - Date.now() < REFRESH_BUFFER_MS

  let accessToken = decryptToken(creds.access_token)

  if (needsRefresh) {
    // Set refresh token so client can obtain a new access token
    oauth2Client.setCredentials({ refresh_token: decryptToken(creds.refresh_token) })

    // refreshAccessToken() returns { credentials } with new access_token and expiry_date
    // expiry_date is milliseconds since epoch (NOT seconds, NOT ISO string)
    const { credentials } = await oauth2Client.refreshAccessToken()
    accessToken = credentials.access_token!

    // Re-encrypt and write back to DB
    // Only update refresh_token if Google returned a new one (token rotation is not guaranteed)
    await db.from('calendar_credentials').update({
      access_token: encryptToken(credentials.access_token!),
      token_expiry: new Date(credentials.expiry_date!).toISOString(),
      ...(credentials.refresh_token ? {
        refresh_token: encryptToken(credentials.refresh_token),
      } : {}),
    }).eq('contractor_id', contractorId)
  }

  oauth2Client.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}
