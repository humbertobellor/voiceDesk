// src/lib/crypto/tokens.ts
// Source: RESEARCH.md Pattern 5 — verified working in Node.js v25.8.0.
// CLAUDE.md Critical Rule 4: OAuth tokens encrypted at rest with AES-256-GCM.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32  // 256 bits
const IV_BYTES = 12   // 96 bits (GCM standard)

// Suppress unused warning — KEY_BYTES used for documentation/reference
void KEY_BYTES

function getEncryptionKey(): Buffer {
  const hex = process.env.OAUTH_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY contains non-hex characters. ' +
      'Value must contain only 0-9 and a-f characters.'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a string with AES-256-GCM.
 * Output format: iv(hex):tag(hex):ciphertext(hex)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Decrypts a string previously produced by encryptToken().
 * Throws if ciphertext is malformed, tampered, or key is wrong.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid ciphertext format — expected iv:tag:ciphertext')
  }

  const [ivHex, tagHex, encHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}
