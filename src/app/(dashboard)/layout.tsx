// src/app/(dashboard)/layout.tsx
// Source: RESEARCH.md Pattern 6 + PATTERNS.md DashboardLayout.
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomTabBar } from '@/components/dashboard/BottomTabBar'
import { DashboardProviders } from '@/components/dashboard/DashboardProviders'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id, business_name, phone_number, twilio_number')
    .eq('user_id', user.id)
    .maybeSingle()

  // Defense-in-depth: middleware should already have redirected, but double-check here
  if (!contractor?.phone_number) redirect('/setup/phone')

  return (
    <DashboardProviders contractorId={contractor.id}>
      <div className="min-h-screen bg-bg-elevated">
        <Sidebar businessName={contractor.business_name} userEmail={user.email} phoneNumber={contractor.twilio_number} />
        <main className="md:ml-60 min-h-screen pb-14 md:pb-0">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
        <BottomTabBar />
      </div>
    </DashboardProviders>
  )
}
