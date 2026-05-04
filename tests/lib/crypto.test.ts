// Wave 0 stub — implementation in Plan 03 (D-17). Will fail until lib/crypto/tokens.ts is created.
import { describe, it, expect, beforeEach } from 'vitest'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

describe('AES-256-GCM token encryption', () => {
  beforeEach(() => {
    // Set a valid test key (64-char hex = 32 bytes)
    process.env.OAUTH_ENCRYPTION_KEY =
      'a'.repeat(64)  // valid test key; replace with real random key in CI
  })

  it('round-trips a token correctly', () => {
    const original = 'ya29.oauth_refresh_token_value'
    const encrypted = encryptToken(original)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypted value is not plaintext', () => {
    const original = 'secret-token'
    const encrypted = encryptToken(original)
    expect(encrypted).not.toContain(original)
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)  // iv:tag:ciphertext
  })

  it('two encryptions of same value produce different ciphertexts (random IV)', () => {
    const original = 'same-token'
    const enc1 = encryptToken(original)
    const enc2 = encryptToken(original)
    expect(enc1).not.toBe(enc2)
  })

  it('tampered ciphertext throws on decrypt', () => {
    const encrypted = encryptToken('value')
    const tampered = encrypted.slice(0, -4) + 'dead'
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws if key is wrong length', () => {
    process.env.OAUTH_ENCRYPTION_KEY = 'short'
    expect(() => encryptToken('value')).toThrow('OAUTH_ENCRYPTION_KEY must be')
  })
})
