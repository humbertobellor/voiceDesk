// retell-call-classify.test.ts
// RED phase stubs: these tests fail until Plan 04 implements D-09 is_active early return.
// DO NOT implement the production code here — that belongs in retell-call-classify.ts (Plan 04).
import { describe, it } from 'vitest'

describe('retell-call-classify — is_active early return guard (D-09)', () => {
  it('returns early with structured log when contractor.is_active=false', () => {
    throw new Error('not yet implemented')
  })

  it('proceeds normally when contractor.is_active=true', () => {
    throw new Error('not yet implemented')
  })

  it('throws NonRetriableError when contractor is not found', () => {
    throw new Error('not yet implemented')
  })
})
