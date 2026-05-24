/**
 * Phase 11 — Account Page regression suite
 *
 * Covers all 8 checkpoints from the D-01 through D-09 fixes:
 *   C-01  Page renders without 500 / blank screen
 *   C-02  Active subscription — green badge, no deactivated/error banner
 *   C-03  Trialing subscription — indigo badge + "Trial ends [date]" text
 *   C-04  Deactivated state — red "Service suspended" banner + "Update Payment" button
 *   C-05  Load error state — "Failed to load subscription details" error banner
 *   C-06  No duplicate "Loading subscription details..." text at page bottom
 *   C-07  Manage button visible when Stripe customer is linked
 *   C-08  Deactivated banner "Update Payment" button present (D-09 + D-03)
 *
 * ──────────────────────────────────────────────────────────────
 * PREREQUISITES:
 *   - Phase 11 migrations applied (is_active, trial_ends_at columns exist)
 *   - Build deployed (commit 6ddd069 or later)
 *
 * Run against production:
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> \
 *   npx playwright test tests/phase-11-account-page.spec.ts
 *
 * Run locally (dev server via playwright.config.ts):
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> \
 *   npm run test:e2e -- tests/phase-11-account-page.spec.ts
 *
 * C-03, C-04, C-05 mock /api/stripe/subscription via page.route() so they
 * work regardless of the test account's actual subscription state.
 * ──────────────────────────────────────────────────────────────
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? ''
const EMAIL = process.env.E2E_EMAIL ?? ''
const PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!'

const url = (path: string) => BASE_URL ? `${BASE_URL}${path}` : path

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto(url('/auth/login'))
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in to VoiceDesk' }).click()
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

/**
 * Intercepts /api/stripe/subscription and returns a mocked JSON response.
 * Call before navigating to /settings/account.
 */
async function mockSubscription(
  page: Page,
  payload: {
    stripe_customer_id?: string | null
    subscription_status?: string | null
    trial_ends_at?: string | null
    is_active?: boolean
  }
): Promise<void> {
  await page.route('**/api/stripe/subscription', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

/**
 * Forces /api/stripe/subscription to return a non-ok status (simulates load error).
 */
async function mockSubscriptionError(page: Page, status = 500): Promise<void> {
  await page.route('**/api/stripe/subscription', (route) => {
    route.fulfill({ status, body: JSON.stringify({ error: 'internal server error' }) })
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Phase 11 — Account Page Subscription Fixes', () => {
  test.skip(!EMAIL, 'Set E2E_EMAIL+E2E_PASSWORD to run these tests')

  let sharedContext: BrowserContext
  let sharedPage: Page

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext()
    sharedPage = await sharedContext.newPage()
    await login(sharedPage)
    const landed = sharedPage.url()
    if (landed.includes('/auth/') || landed.includes('/pricing')) {
      throw new Error(`Login failed — landed at ${landed}. Check E2E_EMAIL/E2E_PASSWORD.`)
    }
  })

  test.afterAll(async () => {
    await sharedContext.close()
  })

  // Each test navigates fresh (after optional route mock) for isolation.
  test.afterEach(async () => {
    // Clear all route intercepts between tests
    await sharedPage.unrouteAll({ behavior: 'ignoreErrors' })
  })

  // ── C-01: Page renders without 500 / blank screen ─────────────────────────

  test('C-01: page renders without 500 or blank screen', async () => {
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(sharedPage.getByText('500')).not.toBeVisible()

    // Page heading must be visible
    await expect(
      sharedPage.getByRole('heading', { name: 'Account & Billing' })
    ).toBeVisible()
  })

  // ── C-02: Active subscription — green badge, no banners ───────────────────

  test('C-02: active subscription shows green badge and no deactivated/error banner', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_test123',
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Green "active" status text
    const statusSpan = sharedPage.locator('span').filter({ hasText: /^active$/ })
    await expect(statusSpan).toBeVisible({ timeout: 5_000 })
    await expect(statusSpan).toHaveClass(/text-green-400/)

    // No deactivated banner
    await expect(sharedPage.getByText('Service suspended')).not.toBeVisible()
    // No load error banner
    await expect(sharedPage.getByText('Failed to load subscription details')).not.toBeVisible()
    // No trial end date
    await expect(sharedPage.getByText(/Trial ends/)).not.toBeVisible()
  })

  // ── C-03: Trialing — indigo badge + trial end date ────────────────────────

  test('C-03: trialing subscription shows indigo badge and trial end date', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_test123',
      subscription_status: 'trialing',
      trial_ends_at: '2026-06-07T00:00:00.000Z',
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Indigo "trialing" badge
    const statusSpan = sharedPage.locator('span').filter({ hasText: /^trialing$/ })
    await expect(statusSpan).toBeVisible({ timeout: 5_000 })
    await expect(statusSpan).toHaveClass(/text-indigo-400/)

    // Trial end date shown below status
    await expect(sharedPage.getByText(/Trial ends.*June.*7.*2026/i)).toBeVisible()

    // No deactivated banner
    await expect(sharedPage.getByText('Service suspended')).not.toBeVisible()
  })

  // ── C-04: Deactivated — red banner + "Update Payment" button ─────────────

  test('C-04: is_active=false shows deactivated banner with Update Payment button', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_test123',
      subscription_status: 'past_due',
      trial_ends_at: null,
      is_active: false,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Red "Service suspended" banner
    await expect(
      sharedPage.getByText('Service suspended. Update your payment method to restore your VoiceDesk agent.')
    ).toBeVisible({ timeout: 5_000 })

    // "Update Payment" button present in banner
    await expect(
      sharedPage.getByRole('button', { name: 'Update Payment' })
    ).toBeVisible()

    // No load error banner (this is a data state, not a load error)
    await expect(sharedPage.getByText('Failed to load subscription details')).not.toBeVisible()
  })

  // ── C-05: Load error — error banner shown, not "No subscription" ──────────

  test('C-05: fetch failure shows error banner (not "No subscription")', async () => {
    await mockSubscriptionError(sharedPage, 500)
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Error banner must appear
    await expect(
      sharedPage.getByText('Failed to load subscription details. Please refresh the page.')
    ).toBeVisible({ timeout: 5_000 })

    // Must NOT show the misleading "No subscription" text
    await expect(sharedPage.getByText('No subscription')).not.toBeVisible()

    // No deactivated banner (we don't know is_active on error)
    await expect(sharedPage.getByText('Service suspended')).not.toBeVisible()
  })

  // ── C-06: No duplicate loading text at page bottom ────────────────────────

  test('C-06: no duplicate "Loading subscription details..." text at page bottom', async () => {
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // The old duplicate block said exactly "Loading subscription details..." — must be gone
    await expect(
      sharedPage.getByText('Loading subscription details...')
    ).not.toBeVisible()
  })

  // ── C-07: Manage button visible when Stripe customer linked ───────────────

  test('C-07: Manage button visible when stripe_customer_id is present', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: 'cus_test123',
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await expect(sharedPage.getByRole('button', { name: 'Manage' })).toBeVisible({ timeout: 5_000 })
  })

  // ── C-08: No Stripe customer — Manage button hidden, fallback text shown ──

  test('C-08: no Stripe customer hides Manage button and shows fallback text', async () => {
    await mockSubscription(sharedPage, {
      stripe_customer_id: null,
      subscription_status: null,
      trial_ends_at: null,
      is_active: true,
    })
    await sharedPage.goto(url('/settings/account'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Manage button must not appear
    await expect(sharedPage.getByRole('button', { name: 'Manage' })).not.toBeVisible()
    // Fallback label
    await expect(sharedPage.getByText('No Stripe customer linked')).toBeVisible()
  })
})
