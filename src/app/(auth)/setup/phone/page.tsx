// src/app/(auth)/setup/phone/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { PhoneCaptureForm } from '@/components/auth/PhoneCaptureForm'

export const metadata = { title: 'Account Setup — VoiceDesk' }

export default async function PhoneCapturePage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // If user already completed phone capture, send them to /dashboard
  const { data: contractor } = await supabase
    .from('contractors')
    .select('phone_number')
    .eq('user_id', user.id)
    .maybeSingle()
  if (contractor?.phone_number) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <PhoneCaptureForm />
    </main>
  )
}
