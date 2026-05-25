# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 28 new files (greenfield project — no existing codebase)
**Analogs found:** 0 / 28 — All patterns sourced from RESEARCH.md verified code examples

> **Greenfield note:** The project root contains only `CLAUDE.md`. There are no existing
> source files to draw codebase analogs from. Every pattern below is sourced from
> RESEARCH.md (Pattern 1–6 and Code Examples sections), which were verified against
> official Supabase docs, Context7, and npm registry as of 2026-05-04.

---

## File Classification

| New File | Role | Data Flow | Pattern Source | Source Quality |
|----------|------|-----------|----------------|----------------|
| `middleware.ts` | middleware | request-response | RESEARCH.md Pattern 2 | verified (official Supabase docs) |
| `src/lib/supabase/server.ts` | utility | request-response | RESEARCH.md Pattern 1 | verified (Context7 /supabase/ssr) |
| `src/lib/supabase/browser.ts` | utility | request-response | RESEARCH.md Pattern 1 | verified (Context7 /supabase/ssr) |
| `src/lib/supabase/service.ts` | utility | request-response | RESEARCH.md Code Examples | verified (Supabase service role pattern) |
| `src/lib/crypto/tokens.ts` | utility | transform | RESEARCH.md Pattern 5 | verified (Node.js v25.8.0) |
| `src/lib/validations/onboarding.ts` | utility | transform | RESEARCH.md Code Examples | assumed (react-hook-form + zod) |
| `src/app/(auth)/auth/login/page.tsx` | component | request-response | RESEARCH.md Pattern 4 + UI-SPEC Surface 1 | verified |
| `src/app/(auth)/auth/signup/page.tsx` | component | request-response | RESEARCH.md Pattern 4 + UI-SPEC Surface 1 | verified |
| `src/app/(auth)/auth/callback/route.ts` | route | request-response | RESEARCH.md Pattern 3 | verified (Context7 /supabase/ssr) |
| `src/app/(auth)/setup/phone/page.tsx` | component | request-response | RESEARCH.md Code Examples + UI-SPEC Surface 2 | assumed |
| `src/app/(dashboard)/layout.tsx` | component | request-response | RESEARCH.md Pattern 6 | verified (Context7 /vercel/next.js) |
| `src/app/(dashboard)/dashboard/page.tsx` | component | request-response | UI-SPEC Surface 3 empty states | specified |
| `src/app/(dashboard)/calls/page.tsx` | component | request-response | UI-SPEC Surface 3 empty states | specified |
| `src/app/(dashboard)/leads/page.tsx` | component | request-response | UI-SPEC Surface 3 empty states | specified |
| `src/app/(dashboard)/settings/agent/page.tsx` | component | request-response | RESEARCH.md Language Form Example | assumed |
| `src/app/(dashboard)/settings/notifications/page.tsx` | component | request-response | UI-SPEC Surface 3 | specified |
| `src/app/(dashboard)/settings/account/page.tsx` | component | request-response | UI-SPEC Surface 3 | specified |
| `src/app/api/onboarding/create-account/route.ts` | route | CRUD | RESEARCH.md Code Examples | assumed (service role pattern) |
| `src/app/layout.tsx` | component | request-response | Next.js App Router root layout | standard |
| `src/components/auth/LoginForm.tsx` | component | request-response | RESEARCH.md Pattern 4 | verified |
| `src/components/auth/SignupForm.tsx` | component | request-response | RESEARCH.md Pattern 4 | verified |
| `src/components/auth/PhoneCaptureForm.tsx` | component | request-response | RESEARCH.md Language Form Example | assumed |
| `src/components/dashboard/Sidebar.tsx` | component | event-driven | RESEARCH.md Pattern 6 | verified |
| `src/components/dashboard/SetupBanner.tsx` | component | request-response | UI-SPEC Surface 3 banner | specified |
| `src/components/dashboard/EmptyState.tsx` | component | request-response | UI-SPEC Surface 3 empty states | specified |
| `supabase/migrations/20260504000001_initial_schema.sql` | migration | CRUD | RESEARCH.md Full DB Schema | verified |
| `supabase/migrations/20260504000002_rls_policies.sql` | migration | CRUD | RESEARCH.md RLS Policy Patterns | verified |
| `supabase/migrations/20260504000003_contractor_defaults.sql` | migration | CRUD | RESEARCH.md DB Schema defaults | verified |
| `vitest.config.ts` | config | — | RESEARCH.md Validation Architecture | specified |
| `tests/lib/crypto.test.ts` | test | transform | RESEARCH.md Crypto test example | specified |
| `tests/db/rls.test.ts` | test | CRUD | RESEARCH.md RLS test example | specified |
| `tests/db/webhook_events.test.ts` | test | CRUD | RESEARCH.md webhook_events test | specified |
| `tests/db/contractor_settings.test.ts` | test | CRUD | RESEARCH.md Validation Architecture | specified |
| `tests/middleware/phone_capture.test.ts` | test | request-response | RESEARCH.md Validation Architecture | specified |
| `tests/setup.ts` | config | — | RESEARCH.md Validation Architecture | specified |

---

## Pattern Assignments

### `middleware.ts` (middleware, request-response)

**Source:** RESEARCH.md Pattern 2 — "Middleware: Session Refresh + Route Protection"
**Verified:** Official Supabase docs + Context7 /supabase/ssr

**Full pattern** (RESEARCH.md lines 268–326):
```typescript
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
        // CRITICAL: must set on BOTH request AND response
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // MUST call getUser() — not getSession() — to refresh session
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (!user && path.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Phone capture gate (D-02): check for missing contractor OR null phone_number
  if (user && path.startsWith('/dashboard')) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('phone_number')
      .eq('user_id', user.id)
      .single()
    // PITFALL 4: also catches case where no contractors row exists at all
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

**Key rules:**
- `getUser()` not `getSession()` — avoids unverified cookie read (Pitfall 2)
- `setAll` writes to both `request.cookies` and `response.cookies` (Pitfall 3)
- Redirect logic covers: no contractor row at all OR contractor row with null phone_number (Pitfall 4)

---

### `src/lib/supabase/server.ts` (utility, request-response)

**Source:** RESEARCH.md Pattern 1 — "Supabase SSR — Current API (getAll/setAll)"

**Full pattern** (RESEARCH.md lines 232–252):
```typescript
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
```

**Use in:** Server Components, Route Handlers. NOT in Client Components.

---

### `src/lib/supabase/browser.ts` (utility, request-response)

**Source:** RESEARCH.md Pattern 1 — "Supabase SSR — Current API (getAll/setAll)"

**Full pattern** (RESEARCH.md lines 254–261):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Use in:** Client Components only (`'use client'`). The anon key is safe with `NEXT_PUBLIC_` prefix.

---

### `src/lib/supabase/service.ts` (utility, request-response)

**Source:** RESEARCH.md Code Examples — Account Creation route (service role usage)

**Pattern** (derived from RESEARCH.md lines 950–999):
```typescript
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // NEVER use NEXT_PUBLIC_ prefix here
  )
}
```

**Critical rule:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER have the `NEXT_PUBLIC_` prefix. This file is server-only. Service role bypasses RLS — use only in API routes for operations the authenticated user's anon client cannot perform.

---

### `src/lib/crypto/tokens.ts` (utility, transform)

**Source:** RESEARCH.md Pattern 5 — "AES-256-GCM Encryption Utility"
**Verified:** Running Node.js v25.8.0

**Full pattern** (RESEARCH.md lines 403–458):
```typescript
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
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(hex):tag(hex):ciphertext(hex)
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
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

**Key generation (run once, store in env):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### `src/lib/validations/onboarding.ts` (utility, transform)

**Source:** RESEARCH.md Code Examples — phoneSchema and languageSchema

**Pattern** (RESEARCH.md lines 954–1027):
```typescript
import { z } from 'zod'

// Phone capture step (D-02) — used in API route AND client form
export const phoneSchema = z.object({
  phone_number: z.string().regex(/^\+1\d{10}$/, 'Must be +1XXXXXXXXXX format'),
  business_name: z.string().min(1, 'Business name is required'),
  area_code: z.string().regex(/^\d{3}$/, 'Must be a 3-digit area code'),
})
export type PhoneFormData = z.infer<typeof phoneSchema>

// Language selection form (LANG-02)
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es', 'ht']))
    .min(1, 'At least one language must be selected'),
})
export type LanguageFormData = z.infer<typeof languageSchema>

// Signup form
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
export type SignupFormData = z.infer<typeof signupSchema>
```

---

### `src/app/(auth)/auth/callback/route.ts` (route, request-response)

**Source:** RESEARCH.md Pattern 3 — "OAuth Callback Route Handler"
**Verified:** Context7 /supabase/ssr

**Full pattern** (RESEARCH.md lines 332–373):
```typescript
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

  // Redirect to phone capture (D-02) after OAuth
  return NextResponse.redirect(`${origin}${next}`)
}
```

---

### `src/app/api/onboarding/create-account/route.ts` (route, CRUD)

**Source:** RESEARCH.md Code Examples — "Account Creation on First Login"

**Full pattern** (RESEARCH.md lines 947–999):
```typescript
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { phoneSchema } from '@/lib/validations/onboarding'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // 1. Verify caller is authenticated (use anon client + getUser())
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate request body with zod
  const body = phoneSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  // 3. Use service role for write operations (bypasses RLS)
  const serviceClient = createServiceRoleClient()

  // 4. Insert contractors row
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

  // 5. Insert contractor_settings with DB-level defaults
  await serviceClient
    .from('contractor_settings')
    .insert({
      contractor_id: contractor.id,
      business_name: body.data.business_name,
    })

  // 6. Insert notification_settings row (empty)
  await serviceClient
    .from('notification_settings')
    .insert({ contractor_id: contractor.id })

  return NextResponse.json({ contractor_id: contractor.id })
}
```

**Auth pattern:** `createSupabaseServer()` + `getUser()` to authenticate, then `createServiceRoleClient()` for the DB writes. The pattern separates identity verification (anon key) from privileged writes (service role).

---

### `src/app/(dashboard)/layout.tsx` (component, request-response)

**Source:** RESEARCH.md Pattern 6 — "Dashboard Shell: Server + Client Component Split"
**Verified:** Context7 /vercel/next.js

**Full pattern** (RESEARCH.md lines 467–498):
```typescript
// Server Component — no 'use client'
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
        <SetupBanner contractorName={contractor?.business_name} />
        {children}
      </main>
    </div>
  )
}
```

**Server/Client split rule:** Layout is a Server Component (async, fetches data). `Sidebar` is a Client Component (`'use client'`) because it needs `usePathname()` for active state. `SetupBanner` is a Server Component (no interactivity needed in Phase 1).

---

### `src/components/auth/LoginForm.tsx` (component, request-response)

**Source:** RESEARCH.md Pattern 4 — "Google OAuth Sign-In" + UI-SPEC Surface 1

**Core pattern:**
```typescript
'use client'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupFormData } from '@/lib/validations/onboarding'

// Google OAuth (D-01 — primary, prominent CTA)
const handleGoogleSignIn = async () => {
  const supabase = createSupabaseBrowser()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',  // required for Phase 4 calendar integration
        prompt: 'consent',       // forces refresh_token on every re-auth
      },
    },
  })
}

// Email/password form (D-01 — secondary, below "or" divider)
const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
  resolver: zodResolver(signupSchema),
})
```

**UI tokens** (from UI-SPEC Surface 1):
- Google CTA button: `bg-[#F97316] text-[#0F172A] w-full min-h-[44px]`
- Email input: `bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus:ring-[#F97316]`
- Card: `bg-[#1E293B] border-[#334155] rounded-xl p-8`
- Page background: `min-h-screen bg-[#0F172A] flex items-center justify-center`
- Error text: `text-[#EF4444] text-sm`

---

### `src/components/auth/PhoneCaptureForm.tsx` (component, request-response)

**Source:** RESEARCH.md Code Examples — phoneSchema + UI-SPEC Surface 2

**Core pattern:**
```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { phoneSchema, type PhoneFormData } from '@/lib/validations/onboarding'

export function PhoneCaptureForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    mode: 'onSubmit',  // UI-SPEC: validate on submit first; switch to onChange after first failure
  })

  const onSubmit = async (data: PhoneFormData) => {
    const res = await fetch('/api/onboarding/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      window.location.href = '/dashboard'
    }
  }
  // ... render business_name, phone_number, area_code inputs
}
```

**UI tokens** (from UI-SPEC Surface 2):
- Same card layout as auth: `bg-[#1E293B] border-[#334155] rounded-xl p-8`
- Submit button: `bg-[#F97316] text-[#0F172A] w-full min-h-[44px]`
- Helper text: `text-[#94A3B8] text-sm`

---

### `src/components/dashboard/Sidebar.tsx` (component, event-driven)

**Source:** RESEARCH.md Pattern 6 + UI-SPEC Surface 3 Sidebar

**Core pattern:**
```typescript
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PhoneCall, Users, Settings, Bot, Bell, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/calls', icon: PhoneCall, label: 'Calls' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 h-screen fixed bg-[#0F172A] border-r border-[#334155] flex flex-col hidden md:flex">
      {/* Logo area — h-16 */}
      {/* Nav items */}
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 py-3 rounded-lg mx-2 min-h-[48px]',
              isActive
                ? 'text-[#F8FAFC] bg-[#1E293B] border-l-4 border-[#F97316] pl-[12px]'
                : 'text-[#94A3B8] px-4 hover:bg-[#1E293B] hover:text-[#F8FAFC]'
            )}
          >
            <Icon size={20} />
            <span className={isActive ? 'font-semibold' : 'font-normal'}>{label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
```

**UI rules** (UI-SPEC Surface 3):
- Active item: `border-l-4 border-[#F97316] pl-[12px]` (12px compensates for 4px border to preserve visual text indent)
- Mobile: `hidden md:flex` on sidebar; bottom tab bar (`flex md:hidden`) is a separate component

---

### `src/components/dashboard/SetupBanner.tsx` (component, request-response)

**Source:** UI-SPEC Surface 3 — "Complete Setup Banner"

**Full pattern:**
```typescript
// Server Component — no 'use client' needed
interface SetupBannerProps {
  contractorName?: string | null
}

export function SetupBanner({ contractorName }: SetupBannerProps) {
  const steps = [
    { label: '1. Add phone', complete: true },     // Phase 1: always complete after /setup/phone
    { label: '2. Configure agent', complete: false },
    { label: '3. Connect calendar', complete: false },
    { label: '4. Test call', complete: false },
  ]

  return (
    <div className="bg-[#F97316]/15 border border-[#F97316]/30 rounded-xl p-4 mb-6 h-16 flex items-center justify-between">
      <div>
        <p className="text-base font-semibold text-[#F8FAFC]">Complete your setup</p>
        <p className="text-sm text-[#94A3B8]">
          Your VoiceDesk receptionist isn't active yet.
        </p>
        <div className="flex gap-2 mt-3">
          {steps.map((step) => (
            <div key={step.label} className="flex flex-col items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${step.complete ? 'bg-[#F97316]' : 'bg-[#334155]'}`} />
              <span className="text-xs text-[#94A3B8]">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      <a href="/settings/agent" className="bg-[#F97316] text-[#0F172A] px-3 py-1.5 rounded text-sm font-semibold">
        Continue Setup →
      </a>
    </div>
  )
}
```

---

### `src/components/dashboard/EmptyState.tsx` (component, request-response)

**Source:** UI-SPEC Surface 3 — "Empty States"

**Full pattern:**
```typescript
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  body: string
  cta?: { label: string; href: string }
}

export function EmptyState({ icon: Icon, heading, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] md:min-h-[240px]">
      <Icon size={48} className="text-[#334155] mb-4" />
      <h2 className="text-xl font-semibold text-[#F8FAFC] mb-2">{heading}</h2>
      <p className="text-sm text-[#94A3B8] max-w-[320px] text-center mb-6">{body}</p>
      {cta && (
        <a
          href={cta.href}
          className="border border-[#F97316] text-[#F97316] px-4 py-2 rounded text-base font-normal"
        >
          {cta.label}
        </a>
      )}
    </div>
  )
}
```

---

### `supabase/migrations/20260504000001_initial_schema.sql` (migration, CRUD)

**Source:** RESEARCH.md — "Full Database Schema (9 Tables)"

**Pattern summary:** All 9 tables with their exact DDL from RESEARCH.md lines 514–733. Key rules:
- Every `CREATE TABLE` includes `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Every table that belongs to a contractor uses `contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE`
- `contractors` table has `UNIQUE (user_id)` — one account per auth user
- `contractor_settings` has check constraint: `CHECK (supported_languages <@ ARRAY['en','es','ht']::TEXT[])` (RESEARCH.md Pitfall 5)
- `webhook_events` has `UNIQUE (source, event_type, external_id)` — idempotency key (D-16)
- `appointments` has `UNIQUE (contractor_id, starts_at)` — booking conflict lock
- **CRITICAL:** `ALTER TABLE [name] ENABLE ROW LEVEL SECURITY` goes in this file, immediately after each `CREATE TABLE` — never defer to a later migration

---

### `supabase/migrations/20260504000002_rls_policies.sql` (migration, CRUD)

**Source:** RESEARCH.md — "RLS Policy Patterns"

**Pattern A — Tables with direct `user_id` column (contractors only):**
```sql
CREATE POLICY "contractors_select_own"
  ON contractors FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_insert_own"
  ON contractors FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_update_own"
  ON contractors FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "contractors_delete_own"
  ON contractors FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

**Pattern B — Tables with `contractor_id` FK (all 8 other tables):**
```sql
-- Replace TABLE_NAME and table_name with each table
CREATE POLICY "TABLE_NAME_select_own"
  ON table_name FOR SELECT TO authenticated
  USING (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "TABLE_NAME_insert_own"
  ON table_name FOR INSERT TO authenticated
  WITH CHECK (
    contractor_id IN (
      SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "TABLE_NAME_update_own"
  ON table_name FOR UPDATE TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "TABLE_NAME_delete_own"
  ON table_name FOR DELETE TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));
```

**Pattern C — `webhook_events` (service-role only):**
```sql
CREATE POLICY "webhook_events_deny_all"
  ON webhook_events FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
-- Service role bypasses RLS; app code always uses service client for this table
```

Apply Pattern B to: `contractor_settings`, `calls`, `leads`, `appointments`, `calendar_credentials`, `notification_log`, `notification_settings`.

---

### Test files (RESEARCH.md Validation Architecture)

**`tests/lib/crypto.test.ts`** — Copy from RESEARCH.md lines 1169–1212 verbatim. Tests: round-trip, no plaintext leakage, random IV (two encryptions differ), tampered ciphertext throws, wrong key length throws.

**`tests/db/rls.test.ts`** — Copy from RESEARCH.md lines 1060–1126 verbatim. Uses two Supabase clients authenticated as different test users (Bearer JWT header). Tests SELECT/INSERT/UPDATE/DELETE isolation for each table.

**`tests/db/webhook_events.test.ts`** — Copy from RESEARCH.md lines 1132–1163 verbatim. Uses service role client. Tests that duplicate `(source, event_type, external_id)` returns PostgreSQL error code `23505`.

**`tests/db/contractor_settings.test.ts`** — Tests that `supported_languages` accepts `['en','es','ht']` and rejects `['fr']` via the check constraint added in migration 1. Pattern matches `webhook_events.test.ts` structure.

**`tests/middleware/phone_capture.test.ts`** — Unit test for middleware redirect logic. Mock `getUser()` to return an authenticated user with no `phone_number`; assert redirect to `/setup/phone`.

**`vitest.config.ts`** — Standard Vitest config with `@vitejs/plugin-react`, path aliases (`@/` → `src/`), and `jsdom` environment for component tests.

---

## Shared Patterns

### Authentication: `getUser()` not `getSession()`

**Rule:** Never call `supabase.auth.getSession()` on the server. Always use `supabase.auth.getUser()`.
**Apply to:** `middleware.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/api/onboarding/create-account/route.ts`
**Source:** RESEARCH.md Anti-Patterns, Pitfall 2, RESEARCH.md lines 502–503

```typescript
// CORRECT — validates JWT against Auth server
const { data: { user } } = await supabase.auth.getUser()

// WRONG — reads unverified cookie (can be spoofed)
const { data: { session } } = await supabase.auth.getSession()  // DO NOT USE
```

### Service Role Isolation

**Rule:** The `createServiceRoleClient()` function is called only inside API route handlers (`app/api/**`). Never in Server Components, Client Components, or middleware.
**Apply to:** `src/app/api/onboarding/create-account/route.ts`
**Source:** RESEARCH.md Architectural Responsibility Map + Critical Rules in CLAUDE.md

```typescript
// Pattern: verify identity with anon client, write with service client
const supabase = await createSupabaseServer()   // anon key — getUser() for auth
const serviceClient = createServiceRoleClient()  // service key — bypasses RLS for writes
```

### Form Pattern: react-hook-form + zod

**Rule:** All validated forms use react-hook-form with zodResolver. Initial `mode: 'onSubmit'`; error display activates on first submit failure.
**Apply to:** `LoginForm.tsx`, `SignupForm.tsx`, `PhoneCaptureForm.tsx`, future settings forms
**Source:** RESEARCH.md Standard Stack (react-hook-form 7.75.0 + zod 4.4.2)

```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<T>({
  resolver: zodResolver(schema),
  mode: 'onSubmit',
})
```

### Color Token Application

**Rule:** Never use raw hex values inline — always use the CSS variable names defined in the design system. In Phase 1 (before shadcn init), use Tailwind arbitrary values (`bg-[#0F172A]`) until CSS variables are wired up via `globals.css`.
**Apply to:** All component files
**Source:** UI-SPEC Color section

| Role | Tailwind class |
|------|---------------|
| Page/sidebar background | `bg-[#0F172A]` |
| Card/surface background | `bg-[#1E293B]` |
| Accent (CTA, active state) | `bg-[#F97316]`, `text-[#F97316]`, `border-[#F97316]` |
| Text primary | `text-[#F8FAFC]` |
| Text secondary/muted | `text-[#94A3B8]` |
| Border | `border-[#334155]` |
| Error | `text-[#EF4444]` |

### RLS Policy Naming Convention

**Rule:** All RLS policies follow the naming pattern `"tablename_operation_own"`.
**Apply to:** Both migration files
**Source:** RESEARCH.md RLS Policy Patterns

Examples: `"contractors_select_own"`, `"contractor_settings_insert_own"`, `"calls_delete_own"`

### Supabase Cookie API

**Rule:** All Supabase clients use `getAll`/`setAll` (not the older `get`/`set`/`remove` API).
**Apply to:** `middleware.ts`, `src/lib/supabase/server.ts`, `src/app/(auth)/auth/callback/route.ts`
**Source:** RESEARCH.md Pattern 1 + State of the Art section

---

## No Analog Found

All 28+ files have no codebase analog (greenfield project). Patterns are sourced as follows:

| File | Pattern Source |
|------|---------------|
| All `src/lib/supabase/*.ts` | RESEARCH.md Patterns 1 (verified) |
| `middleware.ts` | RESEARCH.md Pattern 2 (verified) |
| `src/app/(auth)/auth/callback/route.ts` | RESEARCH.md Pattern 3 (verified) |
| `src/lib/crypto/tokens.ts` | RESEARCH.md Pattern 5 (verified, Node.js v25.8.0) |
| `src/app/(dashboard)/layout.tsx` | RESEARCH.md Pattern 6 (verified) |
| Auth components | RESEARCH.md Pattern 4 + UI-SPEC Surface 1 |
| Phone capture | RESEARCH.md Code Examples + UI-SPEC Surface 2 |
| Dashboard shell components | UI-SPEC Surface 3 |
| API route | RESEARCH.md Code Examples |
| SQL migrations | RESEARCH.md Full DB Schema + RLS Policy Patterns |
| Test files | RESEARCH.md Validation Architecture (copy verbatim) |

---

## Metadata

**Analog search scope:** `/Users/humbertobello/development/ai/claude-code/voiceDesk/` — only `CLAUDE.md` present
**Files scanned:** 1 (CLAUDE.md — project instructions only; no source files exist)
**Pattern extraction date:** 2026-05-04
**Pattern sources:** RESEARCH.md (6 named patterns + code examples), UI-SPEC.md (3 surfaces), CONTEXT.md (18 decisions)
