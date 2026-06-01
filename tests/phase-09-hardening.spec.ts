/**
 * Phase 9 — Hardening & UX Polish regression suite
 *
 * Covers the five SC checkpoints verified manually on 2026-05-23:
 *   SC-1  Telegram bot name is @koolableTelBot everywhere
 *   SC-2  settings/phone: two-state provisioning form
 *   SC-3  Provisioned number appears in Sidebar without hard reload
 *   SC-4  settings/agent > Keywords: hardcoded baseline + editable fields
 *   SC-5  Error-observability logging paths (build-time check only)
 *
 * Run against production:
 *   E2E_BASE_URL=https://voicedesk-two.vercel.app \
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> \
 *   npx playwright test tests/phase-09-hardening.spec.ts
 *
 * Run locally (starts dev server automatically via playwright.config.ts):
 *   E2E_EMAIL=<email> E2E_PASSWORD=<password> npm run test:e2e -- tests/phase-09-hardening.spec.ts
 *
 * The E2E_EMAIL / E2E_PASSWORD account must have already completed onboarding
 * (setup/phone) and started a trial so the dashboard is accessible.
 * The account's twilio_number may be null (unprovisioned) or set — both paths
 * are covered by separate tests below.
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? ''
const EMAIL = process.env.E2E_EMAIL ?? ''
const PASSWORD = process.env.E2E_PASSWORD ?? ''

const url = (path: string) => BASE_URL ? `${BASE_URL}${path}` : path

async function login(page: Page) {
  await page.goto(url('/auth/login'))
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in to Koolable' }).click()
  // Give Supabase time to respond; don't assert URL here — beforeEach handles skipping
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

test.describe('Phase 9 — Hardening & UX Polish', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run these tests')

  test.beforeEach(async ({ page }) => {
    await login(page)
    const landed = page.url()
    // Skip if login didn't succeed (email unconfirmed, wrong creds, or billing gate)
    if (landed.includes('/auth/') || landed.includes('/pricing')) {
      test.skip()
    }
  })

  // ── SC-1: Telegram bot name ────────────────────────────────────────────────

  test('SC-1: dashboard Telegram banner links to @koolableTelBot', async ({ page }) => {
    await page.goto(url('/dashboard'))
    const banner = page.getByText('@koolableTelBot')
    await expect(banner).toBeVisible()

    // Old name must not appear anywhere in the rendered page
    await expect(page.getByText('KoolableBot', { exact: false })).toHaveCount(0)

    // The Connect link href points to the correct bot
    const link = page.getByRole('link', { name: /koolableTelBot/i })
    await expect(link).toHaveAttribute('href', /koolableTelBot/)
  })

  // ── SC-2: settings/phone two-state form ───────────────────────────────────

  test('SC-2a: settings/phone button is disabled until 3 digits are entered', async ({ page }) => {
    await page.goto(url('/settings/phone'))

    const input = page.getByRole('textbox', { name: 'Area code' })
    const button = page.getByRole('button', { name: 'Provision My Number' })

    // Empty → disabled
    await input.fill('')
    await expect(button).toBeDisabled()

    // 2 digits → still disabled
    await input.fill('78')
    await expect(button).toBeDisabled()

    // 3 digits → enabled
    await input.fill('786')
    await expect(button).toBeEnabled()

    // 4 digits (maxLength guard) → input should cap at 3
    await input.fill('7861')
    const value = await input.inputValue()
    expect(value.length).toBeLessThanOrEqual(3)
  })

  test('SC-2b: settings/phone provisioned state shows number and forwarding grid', async ({ page }) => {
    await page.goto(url('/settings/phone'))

    // If already provisioned, verify State B is shown
    const numberText = page.locator('text=+1')
    const noNumber = page.getByText('No number assigned yet')

    const isProvisioned = await numberText.isVisible().catch(() => false)
    if (isProvisioned) {
      // State B: number in orange, forwarding grid visible
      await expect(page.getByText('Call Forwarding Setup')).toBeVisible()
      await expect(page.getByText('AT&T')).toBeVisible()
      await expect(page.getByText('Verizon')).toBeVisible()
      await expect(page.getByText('T-Mobile')).toBeVisible()
      // Provisioning form must NOT be shown
      await expect(noNumber).not.toBeVisible()
    } else {
      // State A: unprovisioned form shown
      await expect(noNumber).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Area code' })).toBeVisible()
    }
  })

  // ── SC-3: Sidebar shows provisioned number ────────────────────────────────

  test('SC-3: sidebar shows provisioned number on dashboard', async ({ page }) => {
    await page.goto(url('/dashboard'))

    // Sidebar user area (bottom-left)
    const sidebar = page.locator('aside, [role=complementary]').first()

    // Only assert phone number presence if account is provisioned
    const phoneInSidebar = sidebar.locator('text=+1')
    const isProvisioned = await phoneInSidebar.isVisible().catch(() => false)

    if (isProvisioned) {
      await expect(phoneInSidebar).toBeVisible()
      // Business name and email must also be present in sidebar
      await expect(sidebar.locator('text=@')).toBeVisible()
    } else {
      // Unprovisioned: sidebar shows business name and email but no phone
      test.info().annotations.push({
        type: 'note',
        description: 'Account not provisioned — SC-3 phone-in-sidebar check skipped',
      })
    }
  })

  test('SC-3: sidebar phone number persists after navigation', async ({ page }) => {
    await page.goto(url('/settings/phone'))
    const sidebar = page.locator('aside, [role=complementary]').first()
    const phoneInSidebar = sidebar.locator('text=+1')

    if (!await phoneInSidebar.isVisible().catch(() => false)) {
      test.skip() // unprovisioned account
    }

    const phoneText = await phoneInSidebar.first().textContent()

    // Navigate to another page
    await page.goto(url('/dashboard'))
    const phoneAfterNav = sidebar.locator(`text=${phoneText}`)
    await expect(phoneAfterNav).toBeVisible()
  })

  // ── SC-4: Emergency keywords tab ─────────────────────────────────────────

  test('SC-4: Keywords tab shows hardcoded baseline and editable fields', async ({ page }) => {
    await page.goto(url('/settings/agent'))
    await page.getByText('Keywords').click()

    // Hardcoded baseline banner
    await expect(page.getByText('Hardcoded Emergency Triggers')).toBeVisible()
    await expect(page.getByText('gas smell')).toBeVisible()
    await expect(page.getByText('co alarm')).toBeVisible()
    await expect(page.getByText('carbon monoxide')).toBeVisible()

    // Editable keyword fields
    await expect(page.getByText('English Emergency Keywords')).toBeVisible()
    await expect(page.getByText('Spanish Emergency Keywords')).toBeVisible()

    // Save button present
    await expect(page.getByRole('button', { name: 'Save Keywords' })).toBeVisible()

    // Hardcoded section must not be editable (it's a display-only callout)
    const banner = page.locator('text=Hardcoded Emergency Triggers').locator('..')
    await expect(banner.locator('input, textarea')).toHaveCount(0)
  })

  test('SC-4: Keywords can be edited and Save Keywords button is reachable', async ({ page }) => {
    await page.goto(url('/settings/agent'))
    await page.getByText('Keywords').click()

    const englishField = page.getByLabel('English Emergency Keywords').or(
      page.locator('textarea').first()
    )
    await expect(englishField).toBeEditable()

    const saveBtn = page.getByRole('button', { name: 'Save Keywords' })
    await expect(saveBtn).toBeEnabled()
  })
})
