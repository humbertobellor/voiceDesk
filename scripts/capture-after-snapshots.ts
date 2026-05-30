/**
 * capture-after-snapshots.ts
 *
 * Standalone Playwright script that captures "after" screenshots of 5 key pages
 * after the Wolknitive design-system token sweep (Plans 16-03..16-05) has been applied.
 *
 * These PNGs are paired with the before-snapshots in tests/visual/ for manual
 * visual comparison during the Plan 16-06 human verification gate.
 *
 * Usage:
 *   SNAPSHOT_BASE_URL=http://localhost:3000 npx ts-node scripts/capture-after-snapshots.ts
 *
 * The dev server must already be running before executing this script.
 * Auth-protected pages (dashboard, leads, settings) are captured as-seen when
 * unauthenticated — the login redirect state is a valid after-snapshot.
 *
 * Output files:
 *   tests/visual/login-after.png
 *   tests/visual/dashboard-calls-after.png
 *   tests/visual/leads-after.png
 *   tests/visual/agent-settings-after.png
 *   tests/visual/notification-settings-after.png
 */

import { chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SNAPSHOT_BASE_URL ?? 'http://localhost:3000'

/**
 * Output directory for snapshot PNGs — relative to project root.
 * PNGs are gitignored; only the directory (.gitkeep) is tracked.
 */
const OUTPUT_DIR = path.resolve(__dirname, '..', 'tests', 'visual')

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Navigate to a URL, waiting for network to settle.
 * Falls back to domcontentloaded if networkidle times out (long-polling pages).
 * Auth redirects are logged but not treated as errors — they are valid after-states.
 */
async function navigateTo(
  page: import('@playwright/test').Page,
  urlPath: string,
  label: string
): Promise<void> {
  const targetUrl = `${BASE_URL}${urlPath}`
  console.log(`[capture] ${label}`)
  console.log(`  -> Navigate: ${targetUrl}`)

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 })
  } catch {
    // networkidle can time-out on pages with long-polling; fall back to domcontentloaded.
    console.warn(`  WARNING: networkidle timed out -- retrying with domcontentloaded`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  }

  const finalUrl = page.url()
  if (finalUrl.includes('/auth/login') && !urlPath.includes('/auth/login')) {
    console.log(`  -> Auth redirect detected -- capturing login-redirect state`)
  } else if (!finalUrl.includes(urlPath)) {
    console.warn(`  WARNING: Unexpected redirect: ${finalUrl}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[capture-after-snapshots] Base URL: ${BASE_URL}`)
  console.log(`[capture-after-snapshots] Output:   ${OUTPUT_DIR}`)
  console.log('')

  const browser = await chromium.launch({ headless: true })

  try {
    // Each page gets its own browser context so cookies and redirects don't bleed.

    // 1. Login page -- public, always renders the login form.
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page1 = await ctx1.newPage()
    await navigateTo(page1, '/auth/login', 'Login page')
    await page1.screenshot({ path: path.join(OUTPUT_DIR, 'login-after.png'), fullPage: true })
    console.log(`  Saved: ${path.join(OUTPUT_DIR, 'login-after.png')}\n`)
    await ctx1.close()

    // 2. Dashboard / Calls -- auth-protected; captures redirect state if unauthenticated.
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page2 = await ctx2.newPage()
    await navigateTo(page2, '/dashboard', 'Dashboard / Calls page')
    await page2.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-calls-after.png'), fullPage: true })
    console.log(`  Saved: ${path.join(OUTPUT_DIR, 'dashboard-calls-after.png')}\n`)
    await ctx2.close()

    // 3. Leads -- auth-protected; captures redirect state if unauthenticated.
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page3 = await ctx3.newPage()
    await navigateTo(page3, '/leads', 'Leads page')
    await page3.screenshot({ path: path.join(OUTPUT_DIR, 'leads-after.png'), fullPage: true })
    console.log(`  Saved: ${path.join(OUTPUT_DIR, 'leads-after.png')}\n`)
    await ctx3.close()

    // 4. Agent Settings -- auth-protected; captures redirect state if unauthenticated.
    const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page4 = await ctx4.newPage()
    await navigateTo(page4, '/settings/agent', 'Agent Settings page')
    await page4.screenshot({ path: path.join(OUTPUT_DIR, 'agent-settings-after.png'), fullPage: true })
    console.log(`  Saved: ${path.join(OUTPUT_DIR, 'agent-settings-after.png')}\n`)
    await ctx4.close()

    // 5. Notification Settings -- auth-protected; captures redirect state if unauthenticated.
    const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page5 = await ctx5.newPage()
    await navigateTo(page5, '/settings/notifications', 'Notification Settings page')
    await page5.screenshot({ path: path.join(OUTPUT_DIR, 'notification-settings-after.png'), fullPage: true })
    console.log(`  Saved: ${path.join(OUTPUT_DIR, 'notification-settings-after.png')}\n`)
    await ctx5.close()
  } finally {
    await browser.close()
  }

  console.log('[capture-after-snapshots] All 5 snapshots captured successfully.')
  console.log('Next: compare each after-PNG against the corresponding before-PNG in tests/visual/.')
}

main().catch((err: Error) => {
  console.error('[capture-after-snapshots] FATAL:', err.message)
  process.exit(1)
})
