/**
 * Phase 10 — Notification Settings Form regression suite
 *
 * Covers the 12 checkpoints verified during live UAT on 2026-05-23:
 *   C-01  Page renders without 500 / blank screen
 *   C-02  Page shows 4 distinct sections: SMS, WhatsApp, Telegram, Notify me about
 *   C-03  SMS phone input has E.164 placeholder (+1 (305) 555-1234)
 *   C-04  SMS section has an enable toggle (checkbox)
 *   C-05  Toggle SMS OFF → phone input becomes disabled
 *   C-06  Toggle SMS back ON → phone input re-enabled
 *   C-07  Invalid phone → inline red error shown on submit (no persist)
 *   C-08  Valid phone → success banner "Settings saved." shown after submit
 *   C-09  Reload → SMS number persisted (reads back from DB)
 *   C-10  WhatsApp section visible with phone input and enable toggle
 *   C-11  Telegram section visible with Connect link OR connected state
 *   C-12  "Notify me about" section with event toggle checkboxes
 *
 * ──────────────────────────────────────────────────────────────
 * PREREQUISITES — known blockers as of 2026-05-23:
 *
 *   BLOCKER-1: Migration 20260523000015_phase10_notification_settings
 *   has NOT been applied to production. The three columns
 *   (notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled)
 *   do not exist in the live DB. The migration file lives at:
 *     supabase/migrations/20260523000015_phase10_notification_settings.sql
 *   Apply with: supabase db push  (or via Supabase MCP apply_migration)
 *
 *   BLOCKER-2: The notifications page wiring commit (10-05) has NOT been
 *   merged into main. Two worktree branches implement this:
 *     worktree-agent-a860f39e096d5ed22 (commit 638437e)
 *     worktree-agent-ad8e876b4fc3dcd37 (commit 6d63c58)
 *   Until merged and deployed, /settings/notifications shows the Phase 1
 *   EmptyState placeholder ("Set up notifications") for ALL users.
 *
 *   Until both blockers are resolved, all tests in this file will FAIL.
 * ──────────────────────────────────────────────────────────────
 *
 * Run against production (after blockers are resolved):
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> \
 *   npx playwright test tests/phase-10-notification-settings.spec.ts
 *
 * Run locally (uses dev server via playwright.config.ts):
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> \
 *   npm run test:e2e -- tests/phase-10-notification-settings.spec.ts
 *
 * The E2E account must have completed onboarding (setup/phone) and
 * started a trial so the dashboard is accessible. A fresh account
 * created via the sign-up form will also work after BLOCKER-1 is
 * resolved (notification_settings row is inserted during onboarding).
 *
 * For a fully self-contained run that creates its own account:
 *   set SIGNUP_MODE=1 — the beforeAll will sign up rather than log in.
 *   (requires Supabase email confirmation to be disabled in dev, which
 *   it is for the Koolable project.)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? ''
const EMAIL = process.env.E2E_EMAIL ?? ''
const PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!'
/** When set, the suite signs up a fresh account instead of logging in. */
const SIGNUP_MODE = !!process.env.SIGNUP_MODE

const url = (path: string) => BASE_URL ? `${BASE_URL}${path}` : path

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Logs in with EMAIL / PASSWORD and waits for network idle.
 * Skips the current test if the session doesn't land on a dashboard page.
 */
async function login(page: Page): Promise<void> {
  await page.goto(url('/auth/login'))
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in to Koolable' }).click()
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

/**
 * Signs up with a unique timestamp-based email, completes onboarding
 * (business name + phone + area code), and starts a free trial.
 * Returns the email used.
 */
async function signUpFresh(page: Page): Promise<string> {
  const testEmail = `voicedesk.uitest.${Date.now()}@mailinator.com`

  await page.goto(url('/auth/signup'))
  await page.getByRole('textbox', { name: 'Email' }).fill(testEmail)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('textbox', { name: 'Confirm password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Should land on /setup/phone
  await page.waitForURL('**/setup/phone', { timeout: 15_000 })

  await page.getByRole('textbox', { name: 'Business name' }).fill('Test HVAC Co')
  await page.getByRole('textbox', { name: 'Your mobile number' }).fill('+13055550001')
  await page.getByRole('textbox', { name: 'Preferred area code' }).fill('305')
  await page.getByRole('button', { name: 'Complete Setup' }).click()

  // Lands on pricing — select Basic free trial
  await page.waitForURL('**/pricing', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Start free trial' }).first().click()

  // Navigate to dashboard directly (bypasses Stripe checkout)
  await page.goto(url('/dashboard'))
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  return testEmail
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Phase 10 — Notification Settings Form', () => {
  /** Skip entire suite unless credentials or SIGNUP_MODE are provided. */
  test.skip(!SIGNUP_MODE && !EMAIL, 'Set E2E_EMAIL+E2E_PASSWORD or SIGNUP_MODE=1 to run these tests')

  // Shared context/page re-used across all tests in this suite.
  // We sign up / log in once in beforeAll to avoid re-auth overhead.
  let sharedContext: BrowserContext
  let sharedPage: Page
  let testEmail: string

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext()
    sharedPage = await sharedContext.newPage()

    if (SIGNUP_MODE) {
      testEmail = await signUpFresh(sharedPage)
    } else {
      testEmail = EMAIL
      await login(sharedPage)
      const landed = sharedPage.url()
      if (landed.includes('/auth/') || landed.includes('/pricing')) {
        // Auth failed — mark all tests as skipped by throwing
        throw new Error(`Login failed — landed at ${landed}. Check E2E_EMAIL/E2E_PASSWORD.`)
      }
    }
  })

  test.afterAll(async () => {
    await sharedContext.close()
  })

  // Navigate to /settings/notifications before each test for isolation.
  test.beforeEach(async () => {
    await sharedPage.goto(url('/settings/notifications'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  })

  // ── C-01: Page renders without 500 / blank screen ─────────────────────────

  test('C-01: page renders without 500 or blank screen', async () => {
    // If the server returns a 500, Next.js renders an error page with specific text.
    await expect(sharedPage.getByText('Application error')).not.toBeVisible()
    await expect(sharedPage.getByText('500')).not.toBeVisible()

    // The page must have at least a heading — "Notifications"
    await expect(sharedPage.getByRole('heading', { name: 'Notifications' })).toBeVisible()

    // The form must be present — not the empty-state placeholder.
    // "Set up notifications" EmptyState heading must NOT be shown once 10-05 is deployed.
    await expect(sharedPage.getByRole('heading', { name: 'Set up notifications' })).not.toBeVisible()
  })

  // ── C-02: 4 distinct sections ─────────────────────────────────────────────

  test('C-02: page shows 4 distinct sections — SMS, WhatsApp, Telegram, Notify me about', async () => {
    // Section headers rendered by the NotificationSettingsForm cards
    await expect(sharedPage.getByText('SMS', { exact: true })).toBeVisible()
    await expect(sharedPage.getByText('WhatsApp', { exact: true })).toBeVisible()
    await expect(sharedPage.getByText('Telegram', { exact: true })).toBeVisible()
    await expect(sharedPage.getByText('Notify me about')).toBeVisible()
  })

  // ── C-03: SMS phone input placeholder ────────────────────────────────────

  test('C-03: SMS phone input has E.164 placeholder', async () => {
    const smsInput = sharedPage.getByLabel('SMS number')
    await expect(smsInput).toBeVisible()
    // Placeholder should hint E.164 format — component uses "+1 (305) 555-1234"
    await expect(smsInput).toHaveAttribute('placeholder', /^\+1/)
  })

  // ── C-04: SMS enable toggle present ──────────────────────────────────────

  test('C-04: SMS section has an enable toggle checkbox', async () => {
    const toggle = sharedPage.getByRole('checkbox', { name: /send sms notifications/i })
    await expect(toggle).toBeVisible()
  })

  // ── C-05 + C-06: Toggle SMS OFF disables input; toggle back ON re-enables ─

  test('C-05/C-06: SMS enable toggle disables and re-enables phone input', async () => {
    const toggle = sharedPage.getByRole('checkbox', { name: /send sms notifications/i })
    const smsInput = sharedPage.getByLabel('SMS number')

    // Ensure toggle is ON first
    if (!(await toggle.isChecked())) {
      await toggle.click()
    }
    await expect(smsInput).toBeEnabled()

    // C-05: Toggle OFF → input disabled
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect(smsInput).toBeDisabled()

    // C-06: Toggle back ON → input re-enabled
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect(smsInput).toBeEnabled()
  })

  // ── C-07: Invalid phone triggers inline red error ──────────────────────────

  test('C-07: invalid phone number shows inline error on submit', async () => {
    const toggle = sharedPage.getByRole('checkbox', { name: /send sms notifications/i })
    const smsInput = sharedPage.getByLabel('SMS number')
    const saveButton = sharedPage.getByRole('button', { name: 'Save Settings' })

    // Ensure SMS is enabled so we can type in the field
    if (!(await toggle.isChecked())) {
      await toggle.click()
    }

    // Type invalid phone then submit
    await smsInput.fill('notanumber')
    await saveButton.click()

    // An inline error with role="alert" should appear under the SMS field
    const smsError = sharedPage.locator('#sms_number_error')
    await expect(smsError).toBeVisible({ timeout: 5_000 })
    await expect(smsError).toHaveText(/valid.*phone|phone.*valid/i)

    // Clear invalid value so subsequent tests start clean
    await smsInput.fill('')
  })

  // ── C-08: Valid phone shows success banner ────────────────────────────────

  test('C-08: valid phone saves successfully and shows success banner', async () => {
    const toggle = sharedPage.getByRole('checkbox', { name: /send sms notifications/i })
    const smsInput = sharedPage.getByLabel('SMS number')
    const saveButton = sharedPage.getByRole('button', { name: 'Save Settings' })

    // Ensure SMS is enabled
    if (!(await toggle.isChecked())) {
      await toggle.click()
    }

    // Clear any previous value and enter a valid number
    await smsInput.fill('+13055551234')
    await saveButton.click()

    // Success banner with role="status" must appear
    const successBanner = sharedPage.locator('[role=status]')
    await expect(successBanner).toBeVisible({ timeout: 10_000 })
    await expect(successBanner).toContainText(/saved/i)
  })

  // ── C-09: Persistence — reload shows saved number ─────────────────────────

  test('C-09: SMS number persists after page reload', async () => {
    // This test depends on C-08 having saved +13055551234.
    // If run in isolation, ensure the number is saved first.
    const toggle = sharedPage.getByRole('checkbox', { name: /send sms notifications/i })
    const smsInput = sharedPage.getByLabel('SMS number')
    const saveButton = sharedPage.getByRole('button', { name: 'Save Settings' })

    if (!(await toggle.isChecked())) {
      await toggle.click()
    }
    await smsInput.fill('+13055551234')
    await saveButton.click()
    // Wait for success banner before reloading
    await expect(sharedPage.locator('[role=status]')).toBeVisible({ timeout: 10_000 })

    // Reload and verify the number is still shown
    await sharedPage.goto(url('/settings/notifications'))
    await sharedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    const reloadedInput = sharedPage.getByLabel('SMS number')
    await expect(reloadedInput).toHaveValue('+13055551234')
  })

  // ── C-10: WhatsApp section visible ────────────────────────────────────────

  test('C-10: WhatsApp section is visible with phone input and enable toggle', async () => {
    await expect(sharedPage.getByText('WhatsApp', { exact: true })).toBeVisible()
    await expect(sharedPage.getByLabel('WhatsApp number')).toBeVisible()
    await expect(
      sharedPage.getByRole('checkbox', { name: /send whatsapp notifications/i })
    ).toBeVisible()
  })

  // ── C-11: Telegram section visible ───────────────────────────────────────

  test('C-11: Telegram section visible with connect link or connected state', async () => {
    await expect(sharedPage.getByText('Telegram', { exact: true })).toBeVisible()

    // Either the "Connect" link (not-connected state) or the "Telegram connected" badge
    const connectLink = sharedPage.getByRole('link', { name: /koolableTelBot/i })
    const connectedBadge = sharedPage.getByText('Telegram connected')

    const isConnected = await connectedBadge.isVisible().catch(() => false)
    const hasConnectLink = await connectLink.isVisible().catch(() => false)

    expect(isConnected || hasConnectLink).toBe(true)

    if (hasConnectLink) {
      // Link must point to the correct bot
      await expect(connectLink).toHaveAttribute('href', /t\.me\/koolableTelBot/)
    }
  })

  // ── C-12: "Notify me about" section with event toggles ───────────────────

  test('C-12: Notify me about section visible with event toggle checkboxes', async () => {
    await expect(sharedPage.getByText('Notify me about')).toBeVisible()

    // Three event toggles
    await expect(sharedPage.getByRole('checkbox', { name: /new leads/i })).toBeVisible()
    await expect(sharedPage.getByRole('checkbox', { name: /emergencies/i })).toBeVisible()
    await expect(sharedPage.getByRole('checkbox', { name: /general inquiries/i })).toBeVisible()
  })
})
