// middleware.ts
// Source: RESEARCH.md Pattern 2 + Pitfall 4 (phone capture bypass).
// CRITICAL: getUser() not getSession() — see RESEARCH.md Pitfall 2 + Anti-Patterns.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // CRITICAL: write cookies to BOTH request and response (Pitfall 3)
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // MUST call getUser() to refresh session (Pitfall 2)
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // All routes inside the (dashboard) route group — none share the /dashboard prefix.
  // Actual portal hrefs: /calls, /leads, /settings/*, /connect-calendar, /dashboard (home).
  const isDashboardRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/calls') ||
    path.startsWith('/leads') ||
    path.startsWith('/settings') ||
    path.startsWith('/connect-calendar')

  // Unauthenticated users hitting any portal or setup route → /auth/login
  if (!user && (isDashboardRoute || path.startsWith('/setup'))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Authenticated users on /auth/* (login/signup pages) → /dashboard if they have a phone, else /setup/phone
  if (user && path.startsWith('/auth/') && !path.startsWith('/auth/callback')) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('phone_number, is_active')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!contractor?.phone_number) {
      return NextResponse.redirect(new URL('/setup/phone', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Phone capture gate (D-02 + Pitfall 4): authenticated user accessing any portal route
  // must have a contractors row with phone_number set. Both "no row" and "row with null phone"
  // route to /setup/phone.
  if (user && isDashboardRoute) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('phone_number, is_active')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!contractor?.phone_number) {
      return NextResponse.redirect(new URL('/setup/phone', request.url))
    }
    // D-09: Deactivated contractor — redirect to account page (not /setup/phone)
    // Exempt /settings/account itself to prevent redirect loop so contractors can update payment.
    if (contractor.is_active === false && !path.startsWith('/settings/account')) {
      return NextResponse.redirect(new URL('/settings/account', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/onboarding/create-account|api/webhooks/).*)'],
}
