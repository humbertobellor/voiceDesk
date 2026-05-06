// tests/lib/validations.test.ts
// Wave 0 stub — RED anchor for HC removal from zod schema.
// This test FAILS until 02-01b Task 4 (HC code cleanup) changes languageSchema to z.enum(['en','es']).
// D-01: languageSchema must reject 'ht' after Phase 2 cleanup.
import { describe, it, expect } from 'vitest'
import { languageSchema } from '@/lib/validations/onboarding'

describe('languageSchema — HC cleanup (D-01)', () => {
  it('HC cleanup - removes ht from supported_languages schema', () => {
    // This will FAIL (RED) until 02-01b Task 4 removes 'ht' from z.enum.
    // Expected: after cleanup, ['ht'] is rejected.
    expect(
      languageSchema.shape.supported_languages.safeParse(['ht']).success
    ).toBe(false)
  })

  it('accepts valid languages after HC removal', () => {
    expect(
      languageSchema.shape.supported_languages.safeParse(['en']).success
    ).toBe(true)
    expect(
      languageSchema.shape.supported_languages.safeParse(['en', 'es']).success
    ).toBe(true)
  })
})
