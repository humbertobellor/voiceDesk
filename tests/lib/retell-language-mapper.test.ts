// tests/lib/retell-language-mapper.test.ts
// Unit tests for toRetellLanguage() — Retell locale code mapping.
// RESEARCH.md Pattern 3: 'en' → 'en-US', 'es' → 'es-ES'
import { describe, it, expect } from 'vitest'
import { toRetellLanguage } from '@/lib/retell/client'

describe('toRetellLanguage', () => {
  it('maps en to en-US as a string (single language)', () => {
    expect(toRetellLanguage(['en'])).toBe('en-US')
  })
  it('maps es to es-ES as a string (single language)', () => {
    expect(toRetellLanguage(['es'])).toBe('es-ES')
  })
  it('maps multiple languages to an array', () => {
    expect(toRetellLanguage(['en', 'es'])).toEqual(['en-US', 'es-ES'])
  })
  it('returns empty array for empty input', () => {
    expect(toRetellLanguage([])).toEqual([])
  })
})
