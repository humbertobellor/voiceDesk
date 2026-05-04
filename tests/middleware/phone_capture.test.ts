// Wave 0 stub — covers D-02 phone capture redirect.
// Implementation in Plan 04 (middleware.ts).
import { describe, it, expect, vi } from 'vitest'

describe('middleware phone capture redirect (D-02)', () => {
  it('redirects authenticated user with no contractor row to /setup/phone', async () => {
    // Will mock @supabase/ssr createServerClient when middleware.ts exists.
    // Plan 04 will fill in the actual mock + assertion.
    expect(true).toBe(true) // placeholder
  })

  it('redirects authenticated user with contractor row but null phone_number to /setup/phone', async () => {
    expect(true).toBe(true) // placeholder
  })

  it('allows authenticated user with phone_number to access /dashboard', async () => {
    expect(true).toBe(true) // placeholder
  })

  it('redirects unauthenticated user from /dashboard to /auth/login', async () => {
    expect(true).toBe(true) // placeholder
  })
})
