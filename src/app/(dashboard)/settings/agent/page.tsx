// src/app/(dashboard)/settings/agent/page.tsx — Server Component
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { LanguageSettingsForm } from './_components/LanguageSettingsForm'
import type { Language } from '@/types/database'

export const metadata = { title: 'Agent Config — VoiceDesk' }

export default async function AgentConfigPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Look up the contractor for this user
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Read current supported_languages using the user's own client (RLS enforces ownership).
  // No need for service role on a read that the authenticated user is already authorized for.
  const { data: settings } = await supabase
    .from('contractor_settings')
    .select('supported_languages')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  const current: Language[] = (settings?.supported_languages as Language[] | null) ?? ['en']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Agent Configuration</h1>
        <p className="text-sm text-[#94A3B8]">
          Choose the languages your AI receptionist will speak (English, Spanish, Haitian Creole). Business name,
          hours, and after-hours message ship in Phase 6.
        </p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <LanguageSettingsForm current={current} />
    </div>
  )
}
