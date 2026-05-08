// src/app/api/auth/google/callback/route.ts
// Handles Google OAuth2 callback: verifies state, exchanges code, encrypts + stores tokens.
// D-02: Verifies oauth_state cookie matches state param before any DB interaction.
// D-03: Redirects to /dashboard?calendarConnected=1 on success.
// SECURITY: contractor_id derived from JWT user.id — NEVER from URL params (STRIDE: EoP).
// CRITICAL: tokens.expiry_date from googleapis is milliseconds since epoch — NOT seconds.
//   Convert with new Date(tokens.expiry_date) for Supabase TIMESTAMPTZ.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto/tokens'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')

  // D-02: Verify state cookie FIRST — before any DB interaction (CSRF prevention)
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('oauth_state')?.value
  if (!expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL('/dashboard?calendarError=state_mismatch', req.url))
  }
  cookieStore.delete('oauth_state')

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?calendarError=no_code', req.url))
  }

  // Auth check — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', req.url))

  // Derive contractor_id from JWT user.id — NEVER accept from URL params (STRIDE: Elevation of Privilege)
  const db = createServiceRoleClient()
  const { data: contractor } = await db
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) {
    return NextResponse.redirect(new URL('/dashboard?calendarError=no_contractor', req.url))
  }

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    // tokens.expiry_date is milliseconds since epoch (Risk 2: NOT seconds).
    // new Date(ms) is correct; new Date(ms * 1000) would be wrong.
    if (!tokens.access_token || !tokens.refresh_token) {
      // refresh_token is null if prompt:'consent' was omitted or token was not re-granted
      return NextResponse.redirect(new URL('/dashboard?calendarError=missing_tokens', req.url))
    }

    await db.from('calendar_credentials').upsert({
      contractor_id: contractor.id,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      token_expiry: new Date(tokens.expiry_date!).toISOString(),
      scope: tokens.scope ?? null,
    }, { onConflict: 'contractor_id' })

    // D-03: Redirect to dashboard with success param
    return NextResponse.redirect(new URL('/dashboard?calendarConnected=1', req.url))
  } catch (err) {
    console.error('[auth/google/callback] token exchange failed:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL('/dashboard?calendarError=token_exchange_failed', req.url))
  }
}
