// src/lib/openai/client.ts
// OpenAI SDK singleton — server-only.
// CRITICAL: OPENAI_API_KEY must NEVER have NEXT_PUBLIC_ prefix — it would be exposed to the browser.
// Pattern: identical structure to src/lib/retell/client.ts (env guard + singleton).
import 'server-only'
import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}
