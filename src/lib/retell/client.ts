// src/lib/retell/client.ts
// Retell AI SDK singleton — server-only.
// CRITICAL: RETELL_API_KEY must NEVER have NEXT_PUBLIC_ prefix (would expose to browser).
// D-05: Single Retell agent per contractor; this client is used for all Retell API calls.
import 'server-only'
import Retell from 'retell-sdk'

// Retell uses locale codes, not ISO-639-1. VERIFIED: docs.retellai.com/api-references/create-agent.md
const RETELL_LANGUAGE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
}

export function toRetellLanguage(langs: string[]): string | string[] {
  const codes = langs.map((l) => RETELL_LANGUAGE_MAP[l]).filter(Boolean)
  // Single language: pass as string. Multiple: pass as array. (Retell API requirement)
  return codes.length === 1 ? codes[0] : codes
}

let _client: Retell | null = null

export function getRetellClient(): Retell {
  if (!_client) {
    const apiKey = process.env.RETELL_API_KEY
    if (!apiKey) throw new Error('RETELL_API_KEY is not set')
    _client = new Retell({ apiKey })
  }
  return _client
}
