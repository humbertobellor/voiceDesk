// src/app/actions/settings.ts
// Source: D-03 server-action pattern from CONTEXT.md; Plan 03 languageSchema; service role for mutations.
'use server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { languageSchema, type LanguageFormData } from '@/lib/validations/onboarding'

type UpdateResult = { ok: true } | { ok: false; error: string }

export async function updateLanguages(input: LanguageFormData): Promise<UpdateResult> {
  // 1. Authorization: getUser() validates JWT against Supabase Auth (RESEARCH.md Pitfall 2)
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // 2. Validate input against Plan 03 zod schema (LANG-02 floor: ['en'|'es'|'ht'][], min 1)
  const parsed = languageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid language selection.' }
  }

  // 3. Find this user's contractor row
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: cErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (cErr || !contractor) return { ok: false, error: 'Contractor not found for this user.' }

  // 4. Update supported_languages on contractor_settings
  const { error: uErr } = await serviceClient
    .from('contractor_settings')
    .update({ supported_languages: parsed.data.supported_languages })
    .eq('contractor_id', contractor.id)
  if (uErr) return { ok: false, error: uErr.message }

  return { ok: true }
}
