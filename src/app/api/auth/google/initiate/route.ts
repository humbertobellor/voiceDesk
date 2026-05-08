// src/app/api/auth/google/initiate/route.ts
// Initiates Google OAuth2 flow for Calendar integration.
// D-02: Generates random state token, stores in httpOnly cookie, passes as OAuth state param.
// D-04: Uses googleapis OAuth2Client directly.
// Scope: calendar.events (restricted — requires CASA Tier 2 verification for production).
// NOTE: prompt:'consent' REQUIRED — without it, re-auth returns refresh_token:null from getToken().
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createOAuth2Client } from '@/lib/google/client'

export async function GET() {
  const state = randomBytes(32).toString('hex')
  const oauth2Client = createOAuth2Client()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',    // REQUIRED — gets refresh_token for server-side use
    prompt: 'consent',         // REQUIRED — ensures fresh refresh_token on re-auth (Risk 1)
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  })

  // D-02: Set httpOnly state cookie before redirect.
  // sameSite:'lax' (NOT 'strict') — OAuth callback is a cross-site GET redirect; 'strict' blocks the cookie.
  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,  // 10 minutes — D-02 state cookie TTL
    path: '/',
  })

  return NextResponse.redirect(authUrl)
}
