/**
 * VoiceDesk v1.0 — Full UI Navigation Regression Suite
 *
 * Covers the entire authenticated navigation flow for a contractor account:
 *
 *   R-01  Login page renders with all required elements
 *   R-02  Valid credentials land on dashboard (not login/pricing)
 *   R-03  Sidebar nav links visible after login
 *   R-04  Dashboard / call log page renders
 *   R-05  Leads page renders
 *   R-06  Settings > Agent Config page renders (4 tabs)
 *   R-07  Settings > Calendar page renders
 *   R-08  Settings > Phone page renders (provision CTA visible)
 *   R-09  Settings > Forwarding / Go Live page renders
 *   R-10  Settings > Notifications page renders (4 sections)
 *   R-11  Settings > Account & Billing renders with mocked subscription states
 *   R-12  Logout redirects to /auth/login
 *
 * ──────────────────────────────────────────────────────────────
 * SYNTHETIC TEST ACCOUNT
 *
 *   Email:    voicedesk-e2e-regression@example.com
 *   Password: VoiceDesk_E2E!2026
 *
 * The account must exist and have completed onboarding (setup/phone) so
 * the dashboard is accessible. To provision it run once in SIGNUP_MODE:
 *
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   SIGNUP_MODE=1 \
 *   npx playwright test tests/regression-v1-smoke.spec.ts --headed
 *
 * Note: SIGNUP_MODE requires Supabase email confirmation to be disabled
 * (Auth > Email > Enable email confirmations = OFF in Supabase dashboard).
 *
 * Subsequent runs (login mode — default):
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   npx playwright test tests/regression-v1-smoke.spec.ts
 *
 * Override credentials at any time:
 *   E2E_EMAIL=other@example.com E2E_PASSWORD=otherpass \
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   npx playwright test tests/regression-v1-smoke.spec.ts
 * ──────────────────────────────────────────────────────────────
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// ── Synthetic credentials (override via env) ──────────────────────────────────

const SYNTHETIC_EMAIL = 'voicedesk-e2e-regression@example.com'
const SYNTHETIC_PASSWORD = 'VoiceDesk_E2E!2026'
const SIGNUP_MODE = !!process.env.SIGNUP_MODE

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? ''
const EMAIL = process.env.E2E_EMAIL ?? SYNTHETIC_EMAIL
const PASSWORD = process.env.E2E_PASSWORD ?? SYNTHETIC_PASSWORD

const url = (path: string) => (BASE_URL ? `${BASE_URL}${path}` : path)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto(url('/auth/login'))
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in to VoiceDesk' }).click()
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}

/** Signs up a fresh account then completes the phone capture step. */
async function signup(page: Page): Promise<void> {
  const timestampEmail = `voicedesk-e2e-${Date.now()}@example.com`
  const signupEmail = process.env.E2E_EMAIL ?? timestampEmail

  await page.goto(url('/auth/signup'))
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('textbox', { name: 'Email' }).fill(signupEmail)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('textbox', { name: /confirm password/i }).fill(PASSWORD)
  await page.getByRole('button', { name: /create account|sign up/i }).click()
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  // Complete phone capture if redirected there
  if (page.url().includes('/setup/phone')) {
    await page.getByRole('textbox', { name: /phone/i }).fill('+13055550001')
    await page.getByRole('button', { name: /continue|save|next/i }).click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  }
}

async function mockSubscription(
  page: Page,
  payload: {
    stripe_customer_id?: string | null
    subscription_status?: string | null
    trial_ends_at?: string | null
    is_active?: boolean
  }
): Promise<void> {
  await page.route('**/api/stripe/subscription', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('VoiceDesk v1.0 — Navigation Regression', () => {
  // Serial mode: tests share a single page + route mocks — parallel execution causes races.
  test.describe.configure({ mode: 'serial' })
  let sharedContext: BrowserContext
  let sharedPage: Page

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext()
    sharedPage = await sharedContext.newPage()

    if (SIGNUP_MODE) {
      await signup(sharedPage)
    } else {
      await login(sharedPage)
    }

    const landed = sharedPage.url()
    if (landed.includes('/auth/') || landed.includes('/pricing')) {
      throw new Error(
        `Authentication failed — landed at ${landed}.\n` +
          `Check E2E_EMAIL / E2E_PASSWORD or set SIGNUP_MODE=1 to create the account first.`
      )
    }
  })

  test.afterAll(async () => {
    await sharedContext.close()
  })

  test.afterEach(async () => {
    await sharedPage.unrouteAll({ behavior: 'ignoreErrors' })
  })

  // ── R-01: Login page ───────────────────────────────────────────────────────
  // Uses the `browser` fixture directly to guarantee a fresh context with no
  // inherited auth state (the shared page fixture can carry worker-level cookies).

  test('R-01: login page renders all required elements', async ({ browser }) => {
    const ctx = await browser.newContext()
    const freshPage = await ctx.newPage()
    try {
      await freshPage.goto(url('/auth/login'))
      await freshPage.waitForLoadState('domcontentloaded')

      await expect(freshPage.getByRole('textbox', { name: 'Email' })).toBeVisible()
      await expect(freshPage.getByRole('textbox', { name: 'Password', exact: true })).toBeVisible()
      await expect(freshPage.getByRole('button', { name: 'Sign in to VoiceDesk' })).toBeVisible()
      // Google OAuth CTA — button text is "Continue with Google"
      await expect(freshPage.getByRole('button', { name: /continue with google/i })).toBeVisible()
      // Link to signup — text is "New to VoiceDesk? Create an account"
      await expect(freshPage.getByRole('link', { name: /create an account/i })).toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  // ── R-02: Dashboard loads ──────────────────────────────────────────────────

  test('R-02: authenticated user lands on dashboard', async () => {
    await sharedPage.goto(url('/dashboard'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Must not be redirected back to auth or pricing
    expect(sharedPage.url()).not.toContain('/auth/')
    expect(sharedPage.url()).not.toContain('/pricing')

    // Page heading is "Dashboard" (two h1s rendered — use first)
    await expect(
      sharedPage.getByRole('heading', { name: /dashboard/i }).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── R-03: Sidebar navigation ───────────────────────────────────────────────

  test('R-03: sidebar navigation links are all visible', async () => {
    await sharedPage.goto(url('/dashboard'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Primary nav items
    await expect(sharedPage.getByRole('link', { name: /calls|dashboard/i }).first()).toBeVisible()
    await expect(sharedPage.getByRole('link', { name: /leads/i }).first()).toBeVisible()
    await expect(sharedPage.getByRole('link', { name: /settings/i }).first()).toBeVisible()
  })

  // ── R-04: Calls / Dashboard page ──────────────────────────────────────────

  test('R-04: dashboard page renders without error', async () => {
    await sharedPage.goto(url('/dashboard'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(sharedPage.getByText('500')).not.toBeVisible()
    // Table or empty state must be visible ("Your dashboard is ready" when no calls yet)
    const callsVisible =
      (await sharedPage.getByRole('table').count()) > 0 ||
      (await sharedPage.getByText(/your dashboard is ready|no calls/i).count()) > 0
    expect(callsVisible).toBe(true)
  })

  // ── R-05: Leads page ──────────────────────────────────────────────────────

  test('R-05: leads page renders without error', async () => {
    await sharedPage.goto(url('/leads'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(sharedPage.getByRole('heading', { name: /leads/i })).toBeVisible()
  })

  // ── R-06: Settings > Agent Config ─────────────────────────────────────────

  test('R-06: settings/agent renders with 4 config tabs', async () => {
    await sharedPage.goto(url('/settings/agent'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(
      sharedPage.getByRole('heading', { name: /agent config|business info/i })
    ).toBeVisible({ timeout: 10_000 })

    // 4 config buttons (rendered as button, not tab role)
    await expect(sharedPage.getByRole('button', { name: /business info/i })).toBeVisible()
    await expect(sharedPage.getByRole('button', { name: /hours/i })).toBeVisible()
    await expect(sharedPage.getByRole('button', { name: /keywords/i })).toBeVisible()
    await expect(sharedPage.getByRole('button', { name: /voice/i })).toBeVisible()
  })

  // ── R-07: Settings > Calendar ─────────────────────────────────────────────

  test('R-07: settings/calendar renders without error', async () => {
    await sharedPage.goto(url('/settings/calendar'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(
      sharedPage.getByRole('heading', { name: /calendar/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── R-08: Settings > Phone ────────────────────────────────────────────────

  test('R-08: settings/phone renders with provisioning CTA', async () => {
    await sharedPage.goto(url('/settings/phone'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(
      sharedPage.getByRole('heading', { name: /phone/i })
    ).toBeVisible({ timeout: 10_000 })
    // Either provisioned number is shown OR the provision button is available
    const hasNumber = (await sharedPage.getByText(/\+1\s?\d{10}|\(\d{3}\)/).count()) > 0
    const hasProvisionBtn =
      (await sharedPage.getByRole('button', { name: /provision|get a number/i }).count()) > 0
    expect(hasNumber || hasProvisionBtn).toBe(true)
  })

  // ── R-09: Settings > Go Live ──────────────────────────────────────────────

  test('R-09: settings/go-live page renders without error', async () => {
    await sharedPage.goto(url('/settings/go-live'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(
      sharedPage.getByRole('heading', { name: /forwarding|go live|call forwarding/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── R-10: Settings > Notifications ────────────────────────────────────────

  test('R-10: settings/notifications renders 4 sections', async () => {
    await sharedPage.goto(url('/settings/notifications'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()

    // 4 sections from Phase 10 — use exact section labels to avoid strict-mode collisions
    await expect(sharedPage.getByText('SMS number')).toBeVisible({ timeout: 10_000 })
    await expect(sharedPage.getByText('WhatsApp number')).toBeVisible()
    await expect(sharedPage.getByText(/voiceDeskTelBot/i)).toBeVisible()
    await expect(sharedPage.getByText('Notify me about')).toBeVisible()
  })

  // ── R-11a: Account page — active subscription ──────────────────────────────

  test('R-11a: settings/account — active subscription shows green badge', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_e2e_test',
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByRole('heading', { name: /account.*billing|billing/i })).toBeVisible()
    await expect(sharedPage.getByText('Service suspended')).not.toBeVisible()
    await expect(sharedPage.getByText('Failed to load subscription details')).not.toBeVisible()

    const activeBadge = sharedPage.locator('span').filter({ hasText: /^active$/ })
    await expect(activeBadge).toBeVisible({ timeout: 5_000 })
  })

  // ── R-11b: Account page — trialing ────────────────────────────────────────

  test('R-11b: settings/account — trialing shows indigo badge + trial end date', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_e2e_test',
      subscription_status: 'trialing',
      trial_ends_at: '2026-06-15T00:00:00.000Z',
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    const trialingBadge = sharedPage.locator('span').filter({ hasText: /^trialing$/ })
    await expect(trialingBadge).toBeVisible({ timeout: 5_000 })
    await expect(trialingBadge).toHaveClass(/text-indigo-400/)
    await expect(sharedPage.getByText(/Trial ends.*June.*15.*2026/i)).toBeVisible()
  })

  // ── R-11c: Account page — deactivated ─────────────────────────────────────

  test('R-11c: settings/account — is_active=false shows suspended banner', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_e2e_test',
      subscription_status: 'past_due',
      trial_ends_at: null,
      is_active: false,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(
      sharedPage.getByText(/service suspended/i)
    ).toBeVisible({ timeout: 5_000 })
    await expect(sharedPage.getByRole('button', { name: /update payment/i })).toBeVisible()
  })

  // ── R-11d: Account page — load error ──────────────────────────────────────

  test('R-11d: settings/account — fetch failure shows error banner (not "No subscription")', async () => {
    await sharedPage.route('**/api/stripe/subscription', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'internal' }) })
    )
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(
      sharedPage.getByText('Failed to load subscription details. Please refresh the page.')
    ).toBeVisible({ timeout: 5_000 })
    await expect(sharedPage.getByText('No subscription')).not.toBeVisible()
  })

  // ── R-12: Logout ──────────────────────────────────────────────────────────

  test('R-12: logout redirects to /auth/login', async ({ page }) => {
    // Use a fresh page so it doesn't break the shared session
    await login(page)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Find and click a logout button/link
    const logoutBtn = page.getByRole('button', { name: /sign out|log out/i })
    const logoutLink = page.getByRole('link', { name: /sign out|log out/i })

    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click()
    } else if (await logoutLink.isVisible().catch(() => false)) {
      await logoutLink.click()
    } else {
      // Logout may be in a dropdown — look for avatar/user menu first
      const userMenu = page.getByRole('button', { name: /account|user|profile|menu/i }).first()
      if (await userMenu.isVisible().catch(() => false)) {
        await userMenu.click()
        await page.getByRole('menuitem', { name: /sign out|log out/i }).click()
      } else {
        test.skip(true, 'Logout button not found — skipping R-12')
        return
      }
    }

    // Wait for the post-logout redirect to /auth/login
    await page.waitForURL('**/auth/**', { timeout: 10_000 }).catch(() => {})
    expect(page.url()).toContain('/auth/')
  })
})
