// Stub — full AES-256-GCM implementation created in Plan 03 (D-17).
// This file exists only so TypeScript can resolve the import in tests/lib/crypto.test.ts.
// DO NOT use these stubs in production code.

export function encryptToken(_plaintext: string): string {
  throw new Error('encryptToken not yet implemented — see Plan 03')
}

export function decryptToken(_ciphertext: string): string {
  throw new Error('decryptToken not yet implemented — see Plan 03')
}
