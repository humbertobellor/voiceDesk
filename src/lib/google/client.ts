// src/lib/google/client.ts
// Google OAuth2Client factory. Returns a new instance per call — NOT a module singleton —
// because OAuth2Client holds per-request credentials via setCredentials().
// Analog: src/lib/retell/client.ts (same pattern: env validation + new instance per call).
// NEVER prefix GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI with NEXT_PUBLIC_.
import 'server-only'
import { google } from 'googleapis'

/**
 * Creates a new Google OAuth2Client instance using server-side environment variables.
 * Throws if any required env var is missing — fail fast at construction time.
 *
 * SECURITY NOTE (CASA Tier 2): The calendar.events scope used with this client is a
 * restricted Google API scope. Before any beta contractor connects their Google Calendar,
 * move the Google OAuth app to Production mode and complete the CASA Tier 2 security
 * assessment (~3-8 weeks). See: STATE.md blockers.
 */
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth env vars missing: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}
