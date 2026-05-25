# Phase 1: Foundation — Research

**Researched:** 2026-05-04
**Domain:** Supabase schema + RLS, Next.js 14 App Router auth, AES-256-GCM encryption, dashboard shell UI
**Confidence:** HIGH (Core Supabase, Next.js, and Node.js crypto verified via Context7 and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Google sign-in prominent (front and center); email/password secondary ("or continue with email").
- **D-02:** Phone number required at signup — captured on a dedicated post-OAuth/signup step before the contractor can access the dashboard.
- **D-03:** Password reset via Supabase built-in email flow; no custom reset UI for v1.
- **D-04:** Multi-language: Retell agent opens with greeting in all enabled languages; caller chooses explicitly (no auto-detection).
- **D-05:** Greeting order when all three enabled: English → Spanish → Haitian Creole. Fixed, not contractor-configurable in v1.
- **D-06:** Entire call conversation stays in the caller's selected language. DB classification tags remain in English.
- **D-07:** Emergency keywords stored per-language: `{ en: [...], es: [...], ht: [...] }`. Hard-coded gas/CO triggers remain as code constants, not DB.
- **D-08:** `contractor_settings` uses discrete columns, NOT JSONB blob.
- **D-09:** Core columns: `business_name TEXT`, `trade_type TEXT`, `service_area TEXT`, `supported_languages TEXT[]`, `business_hours JSONB`, `emergency_keywords JSONB`, `after_hours_message TEXT`, `agent_voice TEXT`.
- **D-10:** Business hours as per-day JSONB: `{ monday: { open: '08:00', close: '18:00', enabled: true }, ... }`. All 7 days present.
- **D-11:** Emergency keywords per-language JSONB: `{ en: [...], es: [...], ht: [...] }`. Defaults pre-populated on account creation.
- **D-12:** Contractors land on full dashboard immediately after signup + phone capture. "Complete Setup" banner until Phase 7 complete.
- **D-13:** Main nav: Calls / Leads / Settings (Agent Config, Notifications, Account/Billing).
- **D-14:** Responsive from day one; mobile collapses sidebar to bottom tab bar or hamburger.
- **D-15:** Deep navy (#0F172A) background + orange (#F97316) accent. Typography: Inter.
- **D-16:** `webhook_events` table: unique constraint on `(source, event_type, external_id)`.
- **D-17:** `calendar_credentials` with encrypted `access_token` and `refresh_token`. AES-256-GCM utility written in Phase 1.
- **D-18:** RLS test: automated or manual script verifies unprivileged role cannot read/update/insert/delete another contractor's rows in any table.

### Claude's Discretion

- Brand/color: deep navy + orange (D-15).
- Component library: Tailwind CSS utility-first, no heavy component library for v1.
- Form library: react-hook-form + zod.
- Icon set: Lucide React.

### Deferred Ideas (OUT OF SCOPE)

- Holiday/exception hours (per-date overrides).
- Team/multi-user accounts.
- Dark mode toggle.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANG-01 | Agent detects or prompts for caller language at start of each call; conducts entire conversation in caller's language (English, Spanish, Haitian Creole) | D-04, D-05, D-06: schema layer stores `supported_languages TEXT[]` in `contractor_settings`; the selection drives Retell agent config in Phase 2 |
| LANG-02 | Contractor selects which languages their agent supports in the portal; all supported languages available from day one of deployment | D-09: `supported_languages TEXT[]` column; D-11: per-language emergency keyword defaults pre-populated at account creation; language selection UI in agent config settings |
</phase_requirements>

---

## Summary

Phase 1 delivers the entire structural foundation that every subsequent phase builds on. The core technical work falls into four categories: (1) a correct Supabase schema with all 9 tables and airtight RLS policies, (2) Supabase Auth configured for Google OAuth and email/password with a post-auth phone capture step, (3) an AES-256-GCM encryption utility for OAuth tokens, and (4) a Next.js 14 App Router dashboard shell with the Calls/Leads/Settings navigation and appropriate empty states.

The most critical correctness requirement in Phase 1 is RLS. Every table must have all four operation policies (SELECT/INSERT/UPDATE/DELETE) enabled and verified as an unprivileged user before Phase 1 is considered done. The patterns confirmed via Supabase official docs use `(SELECT auth.uid())` (with the SELECT wrapper for query plan caching) and a subquery join for tables that do not have `user_id` directly. The `contractor_settings` table is the key multi-language data structure: `supported_languages TEXT[]` stores the enabled languages, `emergency_keywords JSONB` stores per-language keyword lists, and `business_hours JSONB` stores the per-day schedule.

The `@supabase/ssr` package (v0.10.2) replaces all deprecated `@supabase/auth-helpers-nextjs` packages. The current API uses `getAll`/`setAll` cookie methods (not the older `get`/`set`/`remove` pattern), and the middleware must call `supabase.auth.getUser()` to refresh the session on every request. **Important new finding:** The current Supabase docs now recommend `getClaims()` over `getSession()` for server-side authorization decisions, as `getClaims()` validates the JWT against the project's public keys while `getSession()` reads unverified cookies.

**Primary recommendation:** Build in this exact order within Phase 1: (1) Supabase migrations with all tables + RLS, (2) encryption utility, (3) Next.js project with Supabase SSR setup + middleware + auth callback, (4) signup/login UI, (5) phone capture step, (6) account creation trigger (insert contractors + contractor_settings rows), (7) dashboard shell.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session management | Frontend Server (middleware) | Browser | Supabase SSR requires middleware to refresh cookies on every request; browser client initiates OAuth flow |
| RLS enforcement | Database | — | Postgres enforces at query time; cannot be bypassed by app-layer bugs |
| Contractor row creation | API / Backend (Route Handler) | — | Needs service role for insert after auth.users trigger; never runs client-side |
| OAuth token encryption/decryption | API / Backend | — | AES-256-GCM with server-only key; never touches browser |
| Phone capture step | Frontend Server (Server Component + form) | Browser (react-hook-form) | Form renders as client component; server action validates + writes phone |
| Dashboard shell | Frontend Server (Server Component) | Browser (nav interactivity) | Layout is Server Component; nav active state is Client Component |
| Language config persistence | API / Backend (Server Action) | Database | Server action writes to contractor_settings; RLS enforces ownership |
| Emergency keyword defaults | API / Backend (account creation) | Database (JSONB column) | Defaults written at account creation time by server-side trigger/handler |

---

## Standard Stack

### Core (Phase 1 relevant)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | App Router, Server Components, Route Handlers, middleware | [VERIFIED: npm registry] Project decision; Vercel-native |
| @supabase/ssr | 0.10.2 | SSR-compatible Supabase client (replaces auth-helpers) | [VERIFIED: npm registry] Current replacement for deprecated auth-helpers-nextjs |
| @supabase/supabase-js | 2.105.1 | Supabase client base | [VERIFIED: npm registry] Required by @supabase/ssr |
| react-hook-form | 7.75.0 | Form state, validation integration | [VERIFIED: npm registry] Project decision; D-discretion |
| zod | 4.4.2 | Runtime schema validation, form resolvers | [VERIFIED: npm registry] Project decision |
| tailwindcss | 4.2.4 | Utility-first CSS | [VERIFIED: npm registry] Project decision |
| lucide-react | 1.14.0 | Icon set | [VERIFIED: npm registry] Project decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hookform/resolvers | latest | Connects zod to react-hook-form | All validated forms |
| @radix-ui/react-* | latest | Accessible primitives for nav, dialog, dropdown | Dashboard nav shell components |
| clsx / tailwind-merge | latest | Conditional class merging | All UI components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated — do not use |
| react-hook-form + zod | Server Actions only | Forms with real-time validation need client-side; server actions are secondary |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr react-hook-form zod @hookform/resolvers lucide-react clsx tailwind-merge
```

**Key version note:** `next` is currently at 16.2.4 on npm (not 14.x as CLAUDE.md describes). The project description says "Next.js 14 (App Router)" but the current stable release is 16.x. The planner should scaffold with the current stable release unless the user explicitly wants to pin to 14.x. [ASSUMED: "Next.js 14" in CLAUDE.md is a description of the App Router paradigm, not a hard version pin — confirm with user if scaffolding from scratch]

---

## Architecture Patterns

### System Architecture Diagram

```
BROWSER (contractor)
    │
    │  1. GET /login → redirect to /auth/login
    │  2. POST Google OAuth → redirect to Google consent
    │  3. GET /auth/callback?code=xxx → exchange code → session cookie set
    │  4. GET /setup/phone → capture phone number (required)
    │  5. POST /api/onboarding/create-account → insert contractors + contractor_settings rows
    │  6. Redirect → /dashboard
    ▼
┌─────────────────────────────────┐
│  NEXT.JS MIDDLEWARE              │
│  (middleware.ts)                 │
│  - createServerClient            │
│  - supabase.auth.getUser()       │  ← refreshes session cookies on every request
│  - redirect unauthenticated      │
│    requests to /auth/login       │
│  - redirect users without phone  │
│    to /setup/phone               │
└──────────────┬──────────────────┘
               │
    ┌──────────┴──────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────────────┐               ┌──────────────────────────┐
│  AUTH ROUTES          │               │  DASHBOARD (App Router)  │
│  (app/(auth)/...)     │               │  (app/(dashboard)/...)   │
│                       │               │                          │
│  /auth/login          │               │  layout.tsx              │
│  /auth/signup         │               │  ├── Sidebar (nav)        │
│  /auth/callback       │               │  ├── /dashboard          │
│  /setup/phone         │               │  ├── /dashboard/calls    │
└──────────────────────┘               │  ├── /dashboard/leads    │
                                        │  └── /dashboard/settings │
                                        └──────────┬───────────────┘
                                                   │
                                                   ▼
                                        ┌──────────────────────┐
                                        │  SUPABASE             │
                                        │  (Postgres + Auth)    │
                                        │                       │
                                        │  9 tables, all RLS    │
                                        │  auth.users (managed) │
                                        └──────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                   # Route group — no dashboard layout
│   │   ├── auth/
│   │   │   ├── login/page.tsx    # Login UI (Google + email/password)
│   │   │   ├── signup/page.tsx   # Signup UI
│   │   │   └── callback/route.ts # OAuth code exchange → session
│   │   └── setup/
│   │       └── phone/page.tsx    # Required phone capture step
│   ├── (dashboard)/              # Route group — uses dashboard layout
│   │   ├── layout.tsx            # Sidebar + nav shell (Server Component)
│   │   ├── dashboard/page.tsx    # Overview with "Complete Setup" banner
│   │   ├── calls/page.tsx        # Call log (empty state)
│   │   ├── leads/page.tsx        # Lead list (empty state)
│   │   └── settings/
│   │       ├── agent/page.tsx    # Agent config (language selection lives here)
│   │       ├── notifications/page.tsx
│   │       └── account/page.tsx
│   ├── api/
│   │   └── onboarding/
│   │       └── create-account/route.ts  # Server-side: insert contractors row + contractor_settings
│   └── layout.tsx                # Root layout (Inter font, metadata)
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # createServerClient (Server Components / Route Handlers)
│   │   ├── browser.ts            # createBrowserClient (Client Components)
│   │   └── service.ts            # createServiceRoleClient (API routes only)
│   ├── crypto/
│   │   └── tokens.ts             # encryptToken() / decryptToken() — AES-256-GCM
│   └── validations/
│       └── onboarding.ts         # Zod schemas for signup, phone capture, agent config
├── components/
│   ├── auth/                     # LoginForm, SignupForm, PhoneCaptureForm
│   ├── dashboard/
│   │   ├── Sidebar.tsx           # 'use client' — active state with usePathname
│   │   ├── SetupBanner.tsx       # "Complete Setup" banner
│   │   └── EmptyState.tsx        # Reusable empty state component
│   └── ui/                       # Shared primitives (Button, Input, Label, etc.)
├── middleware.ts                  # Session refresh + route protection
└── supabase/
    └── migrations/
        ├── 20260504000001_initial_schema.sql    # All 9 tables
        ├── 20260504000002_rls_policies.sql      # All RLS policies
        └── 20260504000003_contractor_defaults.sql  # Default language keyword data
```

### Pattern 1: Supabase SSR — Current API (getAll/setAll)

**What:** `@supabase/ssr` 0.10.2 uses `getAll`/`setAll` cookie methods, not the older `get`/`set`/`remove` pattern. Server Components cannot set cookies — only middleware can.

**When to use:** All server-side Supabase operations.

```typescript
// Source: Context7 /supabase/ssr verified against official docs
// lib/supabase/server.ts — for Server Components and Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// lib/supabase/browser.ts — for Client Components
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 2: Middleware — Session Refresh + Route Protection

**What:** Middleware runs on every request; it must call `getUser()` to refresh the session cookie, then enforce route protection.

```typescript
// Source: Context7 /supabase/ssr + official Supabase docs
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // MUST call getUser() to refresh session — do not skip
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect unauthenticated users away from protected routes
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (!user && path.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Redirect authenticated users without phone to phone capture
  // (Check contractor row exists and has phone_number set)
  if (user && path.startsWith('/dashboard')) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('phone_number')
      .eq('user_id', user.id)
      .single()
    if (!contractor?.phone_number) {
      return NextResponse.redirect(new URL('/setup/phone', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth/callback).*)'],
}
```

### Pattern 3: OAuth Callback Route Handler

**What:** After Google OAuth, Supabase redirects to `/auth/callback?code=xxx`. This route exchanges the code for a session (PKCE flow). Must run server-side.

```typescript
// Source: Context7 /supabase/ssr
// app/(auth)/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/setup/phone'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  // After OAuth, redirect to phone capture (D-02)
  return NextResponse.redirect(`${origin}${next}`)
}
```

### Pattern 4: Google OAuth Sign-In (with refresh token)

**What:** Google OAuth initiated client-side. `access_type: 'offline'` and `prompt: 'consent'` required to get a refresh token for the Google Calendar integration in Phase 4.

```typescript
// Source: Supabase official docs (auth-google)
// In a Client Component login button
const handleGoogleSignIn = async () => {
  const supabase = createBrowserClient(...)
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',  // required for Phase 4 calendar tokens
        prompt: 'consent',       // forces refresh_token every re-auth
      },
    },
  })
}
```

**Note:** The Google OAuth tokens for Supabase Auth (identity) are separate from the Google Calendar OAuth tokens needed in Phase 4. The Phase 1 AES-256-GCM utility is written to encrypt the Calendar tokens, not the Supabase Auth tokens.

### Pattern 5: AES-256-GCM Encryption Utility

**What:** App-layer encryption of Google OAuth tokens before writing to `calendar_credentials`. Key stored in `OAUTH_ENCRYPTION_KEY` env var (32 random bytes as hex string). Verified working in Node.js v25.8.0.

```typescript
// Source: Node.js crypto module (VERIFIED: working in Node.js v25.8.0)
// lib/crypto/tokens.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32  // 256 bits
const IV_BYTES = 12   // 96 bits (GCM standard)

function getEncryptionKey(): Buffer {
  const hex = process.env.OAUTH_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Output format: iv(hex):tag(hex):ciphertext(hex)
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivHex, tagHex, encHex] = ciphertext.split(':')

  if (!ivHex || !tagHex || !encHex) {
    throw new Error('Invalid ciphertext format — expected iv:tag:ciphertext')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}

// Key generation helper (run once, store in env):
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Pattern 6: Dashboard Shell — Server + Client Component Split

**What:** Layout is a Server Component that fetches contractor data once. Sidebar is a Client Component for `usePathname` active state. Page slots render as Server Components with empty states.

```typescript
// Source: Context7 /vercel/next.js — Server/Client component split pattern
// app/(dashboard)/layout.tsx — Server Component
import { createSupabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { SetupBanner } from '@/components/dashboard/SetupBanner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-[#0F172A]">
      <Sidebar />  {/* Client Component — uses usePathname */}
      <main className="flex-1 overflow-auto">
        {/* Show banner until Phase 7 complete — always show in Phase 1 */}
        <SetupBanner contractorName={contractor?.business_name} />
        {children}
      </main>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using `getSession()` for authorization:** `getSession()` reads unverified cookies. Use `getUser()` (contacts Auth server) or `getClaims()` for all server-side authorization. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
- **Single RLS policy for all operations:** Writing `FOR ALL` policy misses the `WITH CHECK` requirement for INSERT and UPDATE. Write explicit policies for each operation.
- **Forgetting middleware `setAll` on the response:** Session cookie updates from `getUser()` must be written to the outgoing response. Without this, sessions appear logged out after token refresh.
- **`NEXT_PUBLIC_` prefix on service role key:** Any env var prefixed `NEXT_PUBLIC_` is bundled into the browser. The service role key must never have this prefix.
- **Missing `FOR INSERT WITH CHECK`:** Without an explicit INSERT policy, authenticated users can insert rows with any `contractor_id`, not just their own.

---

## Full Database Schema (9 Tables)

### Table 1: contractors

```sql
-- 20260504000001_initial_schema.sql
CREATE TABLE contractors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name         TEXT NOT NULL DEFAULT '',
  phone_number          TEXT,         -- contractor's own cell (required post-signup)
  area_code             TEXT,         -- for Twilio number provisioning in Phase 2
  twilio_number         TEXT,         -- VoiceDesk-assigned number (set in Phase 2)
  twilio_number_sid     TEXT,         -- Twilio SID (set in Phase 2)
  retell_agent_id       TEXT,         -- Retell agent ID (set in Phase 2)
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  subscription_status   TEXT NOT NULL DEFAULT 'trialing',
                        -- trialing | active | past_due | canceled
  subscription_tier     TEXT NOT NULL DEFAULT 'starter',
  timezone              TEXT NOT NULL DEFAULT 'America/New_York',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX idx_contractors_user_id ON contractors(user_id);
CREATE INDEX idx_contractors_stripe_customer_id ON contractors(stripe_customer_id);
```

### Table 2: contractor_settings (D-08 through D-11)

```sql
CREATE TABLE contractor_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  business_name       TEXT NOT NULL DEFAULT '',
  trade_type          TEXT NOT NULL DEFAULT 'hvac',
                      -- hvac | plumbing | electrical | multi
  service_area        TEXT NOT NULL DEFAULT '',
  supported_languages TEXT[] NOT NULL DEFAULT ARRAY['en'],
                      -- subset of {'en', 'es', 'ht'}; LANG-02
  business_hours      JSONB NOT NULL DEFAULT '{
    "monday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "tuesday":   {"open": "08:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "thursday":  {"open": "08:00", "close": "18:00", "enabled": true},
    "friday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "saturday":  {"open": "09:00", "close": "14:00", "enabled": false},
    "sunday":    {"open": "09:00", "close": "14:00", "enabled": false}
  }',
  emergency_keywords  JSONB NOT NULL DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"],
    "ht": ["sant gaz", "pa gen chàfèt", "tiyo pete", "inondasyon", "pa gen kouran", "alàm CO", "sant brile"]
  }',                 -- D-07: per-language JSONB; gas/CO always hard-coded in Phase 3
  after_hours_message TEXT NOT NULL DEFAULT 'You have reached our after-hours line. Please leave your name, phone number, and a brief description of your issue and we will call you back.',
  agent_voice         TEXT NOT NULL DEFAULT 'elevenlabs-myra',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id)
);

CREATE INDEX idx_contractor_settings_contractor_id ON contractor_settings(contractor_id);
```

### Table 3: calls

```sql
CREATE TABLE calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  retell_call_id   TEXT NOT NULL UNIQUE,
  caller_phone     TEXT,
  caller_name      TEXT,
  twilio_number    TEXT,
  status           TEXT NOT NULL DEFAULT 'in_progress',
                   -- in_progress | completed | failed
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INT,
  recording_url    TEXT,            -- Retell recording URL (not signed; sign at serve time)
  transcript       JSONB,           -- [{speaker, text, timestamp}, ...]
  summary          TEXT,            -- AI-generated (from call_analyzed event in Phase 3)
  intent           TEXT,            -- lead | emergency | info | no_action | unknown
  language         TEXT,            -- caller's selected language: en | es | ht
  is_after_hours   BOOLEAN NOT NULL DEFAULT FALSE,
  raw_metadata     JSONB,           -- full Retell payload for debugging
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_contractor_id ON calls(contractor_id);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_intent ON calls(intent);
CREATE INDEX idx_calls_retell_call_id ON calls(retell_call_id);
```

### Table 4: leads

```sql
CREATE TABLE leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  call_id           UUID REFERENCES calls(id),
  caller_name       TEXT,
  caller_phone      TEXT NOT NULL,
  service_requested TEXT,
  service_type      TEXT,           -- hvac | plumbing | electrical | general
  urgency           TEXT NOT NULL DEFAULT 'normal',
                    -- normal | urgent | emergency
  preferred_time    TEXT,           -- free-text from caller
  notes             TEXT,           -- AI summary
  status            TEXT NOT NULL DEFAULT 'new',
                    -- new | contacted | booked | won | lost
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_contractor_id ON leads(contractor_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
```

### Table 5: appointments

```sql
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  lead_id          UUID REFERENCES leads(id),
  call_id          UUID REFERENCES calls(id),
  google_event_id  TEXT,
  calendar_id      TEXT NOT NULL DEFAULT 'primary',
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  service_address  TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'confirmed',
                   -- confirmed | cancelled | rescheduled
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id, starts_at)   -- booking conflict lock (Phase 4 uses FOR UPDATE)
);

CREATE INDEX idx_appointments_contractor_id ON appointments(contractor_id);
CREATE INDEX idx_appointments_starts_at ON appointments(contractor_id, starts_at);
```

### Table 6: calendar_credentials

```sql
CREATE TABLE calendar_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,    -- AES-256-GCM encrypted (D-17)
  refresh_token   TEXT NOT NULL,   -- AES-256-GCM encrypted (D-17)
  token_expiry    TIMESTAMPTZ NOT NULL,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  scope           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id)
);
-- No index needed beyond the UNIQUE constraint
```

### Table 7: webhook_events (D-16)

```sql
CREATE TABLE webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,        -- 'retell' | 'stripe' | 'twilio'
  event_type   TEXT NOT NULL,
  external_id  TEXT NOT NULL,        -- call_id or Stripe event ID
  payload      JSONB NOT NULL,
  processed    BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, event_type, external_id)   -- D-16: idempotency key
);

CREATE INDEX idx_webhook_events_unprocessed
  ON webhook_events(processed, created_at)
  WHERE processed = FALSE;
```

### Table 8: notification_log

```sql
CREATE TABLE notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  call_id       UUID REFERENCES calls(id),
  channel       TEXT NOT NULL,   -- sms | whatsapp | telegram
  recipient     TEXT NOT NULL,   -- phone number or telegram chat_id
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
                -- pending | sent | failed
  sent_at       TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_contractor_id ON notification_log(contractor_id);
CREATE INDEX idx_notification_log_status ON notification_log(status);
```

### Table 9: notification_settings

```sql
CREATE TABLE notification_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id         UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  sms_number            TEXT,
  whatsapp_number       TEXT,
  telegram_chat_id      TEXT,
  notify_on_lead        BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_emergency   BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_opted_in_at  TIMESTAMPTZ,   -- Phase 7: WABA consent timestamp
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id)
);
```

---

## RLS Policy Patterns

### Key Supabase RLS Facts (VERIFIED)

- [CITED: supabase.com/docs/guides/auth/row-level-security]
- `USING` clause: filters which existing rows are visible (SELECT, UPDATE, DELETE)
- `WITH CHECK` clause: validates that inserted/modified rows meet the policy
- For UPDATE: both `USING` and `WITH CHECK` must be specified
- `(SELECT auth.uid())` (wrapped in SELECT) caches the UID across rows for better query planning
- Every table needs explicit policies for SELECT, INSERT, UPDATE, DELETE — `FOR ALL` does not include `WITH CHECK`

### Policy Template: Tables with direct user_id column (`contractors`)

```sql
-- Source: CITED supabase.com/docs/guides/auth/row-level-security
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_select_own"
  ON contractors FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_insert_own"
  ON contractors FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_update_own"
  ON contractors FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_delete_own"
  ON contractors FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

### Policy Template: Tables with contractor_id FK (all other tables)

```sql
-- Pattern: subquery join to contractors for every table
-- Applied to: contractor_settings, calls, leads, appointments,
--             calendar_credentials, notification_log, notification_settings

-- Example for contractor_settings:
ALTER TABLE contractor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_settings_select_own"
  ON contractor_settings FOR SELECT
  TO authenticated
  USING (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contractor_settings_insert_own"
  ON contractor_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contractor_settings_update_own"
  ON contractor_settings FOR UPDATE
  TO authenticated
  USING (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contractor_settings_delete_own"
  ON contractor_settings FOR DELETE
  TO authenticated
  USING (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

-- Apply same pattern to: calls, leads, appointments, calendar_credentials,
-- notification_log, notification_settings
```

### Special Case: webhook_events (service-role only, no user-level access)

```sql
-- webhook_events is written by server-side code using the service role.
-- Client-side code never directly reads or writes this table.
-- Deny all access from authenticated/anon roles:
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_deny_all"
  ON webhook_events FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS — handlers use service role client
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management / cookie refresh | Custom JWT cookies | `@supabase/ssr` + middleware | Session expiry edge cases, PKCE flow, secure cookie flags are subtle |
| OAuth PKCE flow | Manual code verifier | `supabase.auth.exchangeCodeForSession()` | PKCE verifier storage and validation is error-prone |
| Form validation | Manual `onChange` state | `react-hook-form` + `zod` | Async validation, dirty state, nested errors are complex to reimplement |
| Token encryption | XOR or base64 "encryption" | AES-256-GCM via `node:crypto` | Authentication tag prevents tampering; base64 is not encryption |
| Password reset flow | Custom email + token | Supabase built-in (D-03) | Token expiry, rate limiting, email delivery are handled |
| Database migrations | Hand-editing Supabase dashboard | Supabase CLI migration files | Reproducibility, version control, multi-env deployments |

---

## Supabase Migration Workflow

[ASSUMED: Supabase CLI migration commands — based on training knowledge, verify against current `supabase db` help output]

```bash
# Initialize Supabase in project root (creates supabase/ directory)
supabase init

# Create a new migration file
supabase migration new initial_schema

# Migrations live at: supabase/migrations/YYYYMMDDHHMMSS_name.sql

# Apply migrations to local dev Supabase instance
supabase db push  # pushes to linked remote project
# OR
supabase start    # starts local stack; migrations auto-apply

# Link to remote Supabase project
supabase link --project-ref <project-ref>
```

**Migration naming convention:**
```
supabase/migrations/
├── 20260504000001_initial_schema.sql      # All 9 CREATE TABLE statements
├── 20260504000002_rls_policies.sql        # All ALTER TABLE + CREATE POLICY statements
└── 20260504000003_indexes.sql             # All CREATE INDEX statements
```

**Key rule:** Every migration that creates a table must include `ALTER TABLE [name] ENABLE ROW LEVEL SECURITY` in the same migration file — never defer RLS to a later migration.

---

## Common Pitfalls

### Pitfall 1: Missing `WITH CHECK` on INSERT/UPDATE Policies

**What goes wrong:** Writing only `USING` clause (which filters reads) but not `WITH CHECK` (which validates writes). A contractor can insert rows with any `contractor_id` — e.g., pointing to a different contractor's account.
**Why it happens:** The `USING` clause is the more familiar concept; `WITH CHECK` is only mentioned in Supabase docs for INSERT/UPDATE.
**How to avoid:** Every INSERT policy must have `WITH CHECK`. Every UPDATE policy must have both `USING` and `WITH CHECK`.
**Warning signs:** Running a test insert from a second account's client succeeds with the wrong `contractor_id`.

### Pitfall 2: `getSession()` Returns Unverified User on Server

**What goes wrong:** Using `supabase.auth.getSession()` in a Server Component or middleware to check if a user is logged in. The user object in the session is read directly from the cookie without JWT verification — it can be spoofed.
**Why it happens:** `getSession()` was the old recommended pattern; newer Supabase docs have shifted to `getUser()` / `getClaims()`.
**How to avoid:** Use `supabase.auth.getUser()` for authorization decisions in Server Components and middleware. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
**Warning signs:** Session appears valid even with a tampered cookie.

### Pitfall 3: Middleware Not Writing Session Cookie Updates to Response

**What goes wrong:** Middleware creates a Supabase client, calls `getUser()` which may refresh the token, but the `setAll` cookie handler only sets cookies on `request`, not on `response`. The refreshed session is lost.
**Why it happens:** The `setAll` in middleware must write to BOTH `request.cookies` (for downstream handlers) AND `response.cookies` (for the browser). [CITED: Context7 /supabase/ssr]
**How to avoid:** In middleware `setAll`, call both `request.cookies.set(name, value)` AND `response.cookies.set(name, value, options)`.
**Warning signs:** Users are logged out after 1 hour even when actively using the app.

### Pitfall 4: Phone Capture Bypass

**What goes wrong:** The middleware checks for a `contractors` row with `phone_number`, but the account creation API route hasn't been called yet (because the user closed the browser after OAuth). On next login, no phone capture is triggered.
**Why it happens:** Middleware logic checks `contractor.phone_number IS NULL` but there is no `contractors` row at all.
**How to avoid:** Middleware must check for two conditions: (1) no `contractors` row at all, OR (2) `contractors` row exists but `phone_number IS NULL`. Both redirect to `/setup/phone`.

### Pitfall 5: `supported_languages` Array Mismatch

**What goes wrong:** Language codes stored in `contractor_settings.supported_languages` don't match what Phase 2 sends to the Retell API. If Phase 1 stores `'english'` and Phase 2 expects `'en'`, the language config is ignored.
**Why it happens:** No formal language code standard is enforced at the DB layer.
**How to avoid:** Store ISO 639-1 codes in all caps consistency: `'en'`, `'es'`, `'ht'`. Add a check constraint: `CHECK (supported_languages <@ ARRAY['en','es','ht']::TEXT[])` — ensures only valid language codes are stored.

### Pitfall 6: AES-256-GCM Key Not 32 Bytes

**What goes wrong:** `OAUTH_ENCRYPTION_KEY` env var is the wrong length. `createCipheriv` throws a runtime error on first token write.
**Why it happens:** Developers set the key from a random password rather than a 32-byte hex string.
**How to avoid:** Validate key length at startup. The encrypt/decrypt functions above validate that the hex string is exactly 64 characters (32 bytes). Generate key with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
**Warning signs:** `ERR_CRYPTO_INVALID_KEYLEN` error in Vercel function logs.

---

## Code Examples

### Account Creation on First Login

Triggered by the phone capture form submission. Uses the service role to insert both `contractors` and `contractor_settings` rows atomically.

```typescript
// Source: Pattern derived from Supabase multi-tenant docs [ASSUMED: specific trigger pattern]
// app/api/onboarding/create-account/route.ts
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const phoneSchema = z.object({
  phone_number: z.string().regex(/^\+1\d{10}$/, 'Must be +1XXXXXXXXXX format'),
  business_name: z.string().min(1),
  area_code: z.string().regex(/^\d{3}$/),
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = phoneSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const serviceClient = createServiceRoleClient()  // bypasses RLS for server-side inserts

  // Insert contractors row
  const { data: contractor, error: cErr } = await serviceClient
    .from('contractors')
    .insert({
      user_id: user.id,
      phone_number: body.data.phone_number,
      business_name: body.data.business_name,
      area_code: body.data.area_code,
    })
    .select()
    .single()

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  // Insert contractor_settings with defaults (including all 3 language keyword defaults)
  await serviceClient
    .from('contractor_settings')
    .insert({
      contractor_id: contractor.id,
      business_name: body.data.business_name,
      // All other columns use DB-level defaults (business_hours, emergency_keywords, etc.)
    })

  // Insert notification_settings row (empty)
  await serviceClient
    .from('notification_settings')
    .insert({ contractor_id: contractor.id })

  return NextResponse.json({ contractor_id: contractor.id })
}
```

### Language Selection Form (LANG-02)

```typescript
// Source: [ASSUMED — react-hook-form + zod pattern]
// components/auth/AgentLanguageForm.tsx — 'use client'
'use client'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es', 'ht']))
    .min(1, 'At least one language must be selected'),
})

type LanguageFormData = z.infer<typeof languageSchema>

export function AgentLanguageForm({ current }: { current: string[] }) {
  const { register, handleSubmit } = useForm<LanguageFormData>({
    resolver: zodResolver(languageSchema),
    defaultValues: { supported_languages: current as ('en' | 'es' | 'ht')[] },
  })
  // ... form render with checkboxes for English, Spanish, Haitian Creole
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` — Wave 0 creation |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| E2E / integration | Playwright 1.59.1 (available but not needed for Phase 1) |

**Note:** Vitest (4.1.5) and @testing-library/react (16.3.2) are available on npm. [VERIFIED: npm registry]. No test infrastructure exists yet (greenfield). Wave 0 creates the config and test files.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-16 (webhook_events) | Inserting duplicate `(source, event_type, external_id)` throws unique constraint error | Integration (Supabase test client) | `npx vitest run tests/db/webhook_events.test.ts` | Wave 0 |
| D-17 (encryption) | `encryptToken(x)` produces ciphertext; `decryptToken(encryptToken(x)) === x`; tampered ciphertext throws | Unit | `npx vitest run tests/lib/crypto.test.ts` | Wave 0 |
| D-18 (RLS) | User A cannot SELECT/INSERT/UPDATE/DELETE User B's rows in any of the 9 tables | Integration (unprivileged Supabase client) | `npx vitest run tests/db/rls.test.ts` | Wave 0 |
| LANG-02 (language storage) | `contractor_settings.supported_languages` accepts `['en','es','ht']`; rejects `['fr']` via check constraint | Integration | `npx vitest run tests/db/contractor_settings.test.ts` | Wave 0 |
| D-02 (phone capture) | Middleware redirects authenticated user with no `phone_number` to `/setup/phone` | Unit (middleware) | `npx vitest run tests/middleware/phone_capture.test.ts` | Wave 0 |

### How to Test RLS as an Unprivileged User

```typescript
// Source: Pattern based on Supabase test patterns [ASSUMED: specific test client setup]
// tests/db/rls.test.ts

import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

// Create two clients authenticated as different users
// (Uses Supabase test project with seeded test users)
const USER_A_TOKEN = process.env.TEST_USER_A_JWT!
const USER_B_TOKEN = process.env.TEST_USER_B_JWT!

// Unprivileged client for User A (respects RLS)
const clientA = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${USER_A_TOKEN}` } } }
)

const clientB = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${USER_B_TOKEN}` } } }
)

describe('RLS isolation — no cross-tenant data access', () => {
  let contractorA_id: string
  let contractorB_id: string

  beforeAll(async () => {
    // Seed: use service role to create two contractors
    // (seed script runs separately in CI)
    contractorA_id = process.env.TEST_CONTRACTOR_A_ID!
    contractorB_id = process.env.TEST_CONTRACTOR_B_ID!
  })

  it('User A cannot SELECT User B contractor row', async () => {
    const { data } = await clientA
      .from('contractors')
      .select('id')
      .eq('id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it('User A cannot UPDATE User B contractor row', async () => {
    const { error } = await clientA
      .from('contractors')
      .update({ business_name: 'HACKED' })
      .eq('id', contractorB_id)
    expect(error).not.toBeNull()  // or data returned is 0 rows updated
  })

  it('User A cannot INSERT contractor_settings for User B contractor_id', async () => {
    const { error } = await clientA
      .from('contractor_settings')
      .insert({ contractor_id: contractorB_id, business_name: 'HACKED' })
    expect(error).not.toBeNull()
  })

  it('User A cannot SELECT calls belonging to User B', async () => {
    const { data } = await clientA
      .from('calls')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  // Repeat SELECT / INSERT / UPDATE / DELETE for all 9 tables
})
```

### How to Test webhook_events Unique Constraint

```typescript
// tests/db/webhook_events.test.ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

// Uses service role — webhook_events has no user-level access
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('webhook_events idempotency constraint', () => {
  it('rejects duplicate (source, event_type, external_id)', async () => {
    const event = {
      source: 'retell',
      event_type: 'call_ended',
      external_id: 'test-call-id-' + Date.now(),
      payload: { test: true },
    }

    // First insert: should succeed
    const { error: err1 } = await serviceClient
      .from('webhook_events')
      .insert(event)
    expect(err1).toBeNull()

    // Second insert with same composite key: should fail with unique violation
    const { error: err2 } = await serviceClient
      .from('webhook_events')
      .insert(event)
    expect(err2).not.toBeNull()
    expect(err2?.code).toBe('23505')  // PostgreSQL unique_violation
  })
})
```

### How to Test Encryption Utility

```typescript
// tests/lib/crypto.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

describe('AES-256-GCM token encryption', () => {
  beforeEach(() => {
    // Set a valid test key (64-char hex = 32 bytes)
    process.env.OAUTH_ENCRYPTION_KEY =
      'a'.repeat(64)  // valid test key; replace with real random key in CI
  })

  it('round-trips a token correctly', () => {
    const original = 'ya29.oauth_refresh_token_value'
    const encrypted = encryptToken(original)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypted value is not plaintext', () => {
    const original = 'secret-token'
    const encrypted = encryptToken(original)
    expect(encrypted).not.toContain(original)
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)  // iv:tag:ciphertext
  })

  it('two encryptions of same value produce different ciphertexts (random IV)', () => {
    const original = 'same-token'
    const enc1 = encryptToken(original)
    const enc2 = encryptToken(original)
    expect(enc1).not.toBe(enc2)
  })

  it('tampered ciphertext throws on decrypt', () => {
    const encrypted = encryptToken('value')
    const tampered = encrypted.slice(0, -4) + 'dead'
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws if key is wrong length', () => {
    process.env.OAUTH_ENCRYPTION_KEY = 'short'
    expect(() => encryptToken('value')).toThrow('OAUTH_ENCRYPTION_KEY must be')
  })
})
```

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/crypto.test.ts` (encryption utility only)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual RLS verification in Supabase Studio before advancing to Phase 2

### Wave 0 Gaps

- [ ] `vitest.config.ts` — configure with `@vitejs/plugin-react`, path aliases, environment
- [ ] `tests/lib/crypto.test.ts` — covers D-17 encryption utility
- [ ] `tests/db/rls.test.ts` — covers D-18 RLS isolation
- [ ] `tests/db/webhook_events.test.ts` — covers D-16 unique constraint
- [ ] `tests/db/contractor_settings.test.ts` — covers LANG-02 language constraint
- [ ] `tests/middleware/phone_capture.test.ts` — covers D-02 phone redirect
- [ ] `tests/setup.ts` — shared test environment + Supabase test client setup
- [ ] Framework install: `npm install -D vitest @testing-library/react @vitejs/plugin-react`
- [ ] `.env.test` — `TEST_USER_A_JWT`, `TEST_USER_B_JWT`, `TEST_CONTRACTOR_A_ID`, `TEST_CONTRACTOR_B_ID`, `OAUTH_ENCRYPTION_KEY` (test key)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (Google OAuth + email/password) |
| V3 Session Management | yes | `@supabase/ssr` middleware session refresh; HTTP-only cookies |
| V4 Access Control | yes | RLS on all 9 tables; service role key server-only |
| V5 Input Validation | yes | zod on all form inputs and API route bodies |
| V6 Cryptography | yes | AES-256-GCM via `node:crypto` for OAuth token encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access | Information Disclosure | RLS policies on all tables; test D-18 before Phase 1 ships |
| Session cookie spoofing | Spoofing | `getUser()` (server-validated) not `getSession()` (unverified cookie) |
| Service role key in browser | Elevation of Privilege | Never use `NEXT_PUBLIC_` prefix on service role key; audit Next.js bundle |
| Plaintext OAuth tokens at rest | Information Disclosure | AES-256-GCM encryption before Supabase write (D-17) |
| CSRF on OAuth callback | Spoofing | Supabase PKCE flow handles state parameter; `exchangeCodeForSession()` validates |
| Form injection / XSS | Tampering | zod validation on all inputs; React's default HTML escaping |

---

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement in Phase 1 |
|-----------|----------------------|
| RLS on every table with all 4 operation policies | All 9 tables in migration; D-18 test required before Phase 1 done |
| Webhook handler returns 200 immediately (Vercel waitUntil) | Not applicable to Phase 1 (no webhook routes) — establish in Phase 3 |
| Service role key never reaches the browser | `lib/supabase/service.ts` is server-only; no NEXT_PUBLIC_ prefix |
| OAuth tokens encrypted with AES-256-GCM | `lib/crypto/tokens.ts` must exist before any Phase 4 calendar routes |
| Idempotency on all webhook handlers (webhook_events table) | Table created in Phase 1 migrations (D-16) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | ~2023 | auth-helpers is deprecated; all new Next.js projects use @supabase/ssr |
| `cookies: { get, set, remove }` API | `cookies: { getAll, setAll }` API | @supabase/ssr 0.5.0 | Old API still works but is legacy; use getAll/setAll |
| `supabase.auth.getSession()` for auth checks | `supabase.auth.getUser()` or `getClaims()` | Supabase Security Advisory | getSession reads unverified cookies; getUser contacts Auth server |
| Next.js pages router + getServerSideProps | App Router + Server Components | Next.js 13 | App Router is the current standard; no pages router for new projects |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not install.
- `cookies: { get, set, remove }` in Supabase server client: Use `getAll`/`setAll` instead.
- `supabase.auth.getSession()` for authorization: Use `getUser()`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Encryption utility, all server code | yes | v25.8.0 | — |
| npm | Package installation | yes | (bundled with Node) | — |
| Supabase CLI | Running migrations | no | — | Use Supabase Dashboard SQL editor for initial migration; install CLI with `npm install -g supabase` |
| Vercel CLI | Deployment | not checked | — | Deploy via Vercel Dashboard / Git integration |

**Missing dependencies with no fallback:**
- None that block Phase 1 core implementation.

**Missing dependencies with fallback:**
- Supabase CLI (`supabase` not found in PATH): Install with `npm install -g supabase@2.98.0` OR run migrations manually in Supabase Dashboard SQL editor. The CLI is strongly recommended for reproducible migrations.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Next.js 14" in CLAUDE.md refers to the App Router paradigm, not a hard version pin to 14.x | Standard Stack | If user wants exactly 14.x, downgrade `next` in package.json — App Router patterns are identical |
| A2 | Supabase CLI migration file naming format: `YYYYMMDDHHMMSS_name.sql` | Migration Workflow | Check `supabase migration new --help` for actual format |
| A3 | `gsd-sdk query init.phase-op` is not available in this environment | Execution | Non-blocking; research proceeded from direct file reads |
| A4 | Per-language keyword defaults shown in contractor_settings schema are comprehensive enough for v1 | Schema — Table 2 | If contractors need different default keywords, adjust the JSONB default in the migration |
| A5 | Account creation API route needs service role to insert `contractors` row (not anon key) | Code Examples | Verify that anon-key INSERT with RLS `WITH CHECK` passes for the authenticated user's own row — it may not require service role |

---

## Open Questions (RESOLVED)

1. **`getClaims()` vs `getUser()` API availability** — RESOLVED
   - What we know: Supabase docs mention `getClaims()` for JWT validation in newer versions; `getUser()` makes a network call to the Auth server
   - What's unclear: Whether `getClaims()` is available in `@supabase/ssr` 0.10.2 or requires a newer version / different package
   - Recommendation: Use `getUser()` in middleware (safe, verified working); check @supabase/supabase-js changelog for `getClaims()` before switching
   - **RESOLVED:** Plan 04 middleware uses `supabase.auth.getUser()` exclusively (see middleware.ts: `const { data: { user } } = await supabase.auth.getUser()`). All authorization decisions in Server Components (Plan 04 setup/phone page, Plan 05 dashboard layout) and the Plan 04 account-creation API route also use `getUser()`. `getClaims()` is NOT used in Phase 1 — defer evaluation to a future phase if/when @supabase/ssr ships a stable `getClaims()` helper.

2. **Supabase CLI not installed — migration strategy** — RESOLVED
   - What we know: `supabase` CLI not found in PATH; version 2.98.0 available on npm
   - What's unclear: Whether the project has a preference for CLI-based or Dashboard-based migration management
   - Recommendation: Install CLI (`npm install -g supabase@2.98.0`) and use file-based migrations for reproducibility; Wave 0 should include this
   - **RESOLVED:** Plan 03 Task 1 uses the Supabase CLI with `supabase db push --include-all` to apply file-based migrations from `supabase/migrations/`. The Plan 03 [BLOCKING] checkpoint instructs the developer to install the CLI (`npm install -g supabase@2.98.0`) if missing and to run `supabase link --project-ref <ref>` before push. File-based migrations are the locked approach for reproducibility; Dashboard SQL editor is not used.

3. **Account creation trigger: API route vs Supabase DB trigger** — RESOLVED
   - What we know: Two approaches — (a) Next.js API route called after phone capture, (b) Postgres trigger on `auth.users` insert. D-02 requires phone capture before dashboard access.
   - What's unclear: Which approach the planner prefers
   - Recommendation: API route (Pattern from Code Examples above) — more debuggable than DB triggers, easier to add validation; D-02 phone capture naturally gates this call
   - **RESOLVED:** Plan 04 Task 2 implements approach (a) — `src/app/api/onboarding/create-account/route.ts` is a Next.js API route called from the phone capture form after D-02 validation. It uses `createServiceRoleClient` to atomically insert `contractors`, `contractor_settings`, and `notification_settings` rows with rollback on failure. Postgres triggers on `auth.users` are explicitly NOT used in Phase 1.

---

## Sources

### Primary (HIGH confidence)

- Context7 `/supabase/ssr` — `createServerClient`, `createBrowserClient`, `getAll`/`setAll` API, middleware pattern, OAuth redirect, `getUser()` vs `getSession()` guidance
- Context7 `/vercel/next.js` — Route groups, Server/Client component split in layouts, middleware auth patterns, OAuth callback route handlers
- [CITED: supabase.com/docs/guides/auth/row-level-security] — USING vs WITH CHECK, SELECT/INSERT/UPDATE/DELETE policy syntax, `(SELECT auth.uid())` caching pattern
- [CITED: supabase.com/docs/guides/auth/social-login/auth-google] — signInWithOAuth with `access_type: 'offline'`, `prompt: 'consent'`
- [VERIFIED: npm registry] — All package versions confirmed current as of 2026-05-04

### Secondary (MEDIUM confidence)

- [CITED: supabase.com/docs/guides/auth/server-side/nextjs] — New publishable key format, `getClaims()` recommendation, CDN caching warning
- Node.js crypto module — AES-256-GCM pattern verified by running test in Node.js v25.8.0

### Tertiary (LOW confidence)

- Supabase CLI migration naming convention [ASSUMED — verify with `supabase --help`]
- Account creation using service role vs anon key [ASSUMED — RLS WITH CHECK for insert may work with anon key for own row]

---

## Metadata

**Confidence breakdown:**
- Supabase SSR setup and auth patterns: HIGH — verified via Context7 and official docs
- RLS policy syntax: HIGH — verified via supabase.com/docs/guides/auth/row-level-security
- AES-256-GCM encryption utility: HIGH — verified by running in Node.js v25.8.0
- Schema design (9 tables): HIGH — derived from locked decisions D-08 through D-17, consistent with ARCHITECTURE.md
- Next.js App Router structure: HIGH — verified via Context7 /vercel/next.js
- Supabase CLI migration workflow: MEDIUM — training knowledge, CLI not installed, verify commands

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 for Supabase/Next.js (stable); re-verify if @supabase/ssr releases 0.11.x
