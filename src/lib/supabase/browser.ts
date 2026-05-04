// src/lib/supabase/browser.ts
// Source: RESEARCH.md Pattern 1 — for Client Components only.
// Use in 'use client' components. The anon key is safe with NEXT_PUBLIC_ prefix.
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
