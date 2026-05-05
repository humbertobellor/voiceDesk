// src/app/(dashboard)/layout.tsx
// Source: RESEARCH.md Pattern 6 + PATTERNS.md DashboardLayout.
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { SetupBanner } from '@/components/dashboard/SetupBanner'
import { BottomTabBar } from '@/components/dashboard/BottomTabBar'

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
    .select('id, business_name, phone_number')
    .eq('user_id', user.id)
    .maybeSingle()

  // Defense-in-depth: middleware should already have redirected, but double-check here
  if (!contractor?.phone_number) redirect('/setup/phone')

  return (
    <div className="min-h-screen bg-[#1E293B]">
      <Sidebar businessName={contractor.business_name} userEmail={user.email} />
      <main className="md:ml-60 min-h-screen pb-14 md:pb-0">
        <div className="p-4 md:p-8">
          <SetupBanner contractorName={contractor.business_name} />
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}
