// Wave 0 e2e stub — covers signup → phone capture → dashboard flow.
// Implementation completes in Plan 04 (auth pages) + Plan 05 (dashboard shell).
import { test, expect } from '@playwright/test'

test.describe('Auth flow (D-01, D-02)', () => {
  test.skip('signup with email/password redirects to /setup/phone', async ({ page }) => {
    await page.goto('/auth/signup')
    // ...
  })

  test.skip('phone capture submit redirects to /dashboard', async ({ page }) => {
    await page.goto('/setup/phone')
    // ...
  })

  test.skip('Google OAuth button is visually primary on /auth/login', async ({ page }) => {
    await page.goto('/auth/login')
    // Verify the Google CTA has bg-[#F97316]
  })
})
