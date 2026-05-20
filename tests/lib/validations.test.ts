// tests/lib/validations.test.ts
import { describe, it, expect } from 'vitest'
import { signupSchema, languageSchema } from '@/lib/validations/onboarding'

// ── signupSchema ──────────────────────────────────────────────────────────────

describe('signupSchema — email validation', () => {
  const base = { password: 'Password1', confirmPassword: 'Password1' }

  it('rejects plain text with no @ (e.g. "ticon")', () => {
    expect(signupSchema.safeParse({ ...base, email: 'ticon' }).success).toBe(false)
  })

  it('rejects missing TLD (e.g. "a@b")', () => {
    expect(signupSchema.safeParse({ ...base, email: 'a@b' }).success).toBe(false)
  })

  it('rejects empty email', () => {
    const result = signupSchema.safeParse({ ...base, email: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email')
    }
  })

  it('accepts a valid email', () => {
    expect(signupSchema.safeParse({ ...base, email: 'user@example.com' }).success).toBe(true)
  })

  it('carries the correct error message for invalid email', () => {
    const result = signupSchema.safeParse({ ...base, email: 'notanemail' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find(i => i.path.includes('email'))
      expect(emailIssue?.message).toBe('Enter a valid email address.')
    }
  })
})

describe('signupSchema — password validation', () => {
  const base = { email: 'user@example.com', confirmPassword: 'Password1' }

  it('rejects passwords shorter than 8 characters', () => {
    expect(signupSchema.safeParse({ ...base, password: 'Pass1' }).success).toBe(false)
  })

  it('rejects passwords with no uppercase letter', () => {
    expect(signupSchema.safeParse({ ...base, password: 'password1' }).success).toBe(false)
  })

  it('rejects passwords with no number', () => {
    expect(signupSchema.safeParse({ ...base, password: 'Password' }).success).toBe(false)
  })

  it('rejects mismatched confirmPassword', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      confirmPassword: 'Different1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmIssue = result.error.issues.find(i => i.path.includes('confirmPassword'))
      expect(confirmIssue?.message).toBe('Passwords do not match.')
    }
  })

  it('accepts a valid password that meets all requirements', () => {
    expect(
      signupSchema.safeParse({ email: 'user@example.com', password: 'Password1', confirmPassword: 'Password1' }).success
    ).toBe(true)
  })
})

// ── languageSchema ────────────────────────────────────────────────────────────

describe('languageSchema — HC cleanup (D-01)', () => {
  it('HC cleanup - removes ht from supported_languages schema', () => {
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
