'use client'

import { QueryProvider } from '@/lib/query/provider'
import { ContractorProvider } from '@/contexts/ContractorContext'
import { useNotificationsSubscription } from '@/lib/realtime/notificationsSubscription'
import type { ReactNode } from 'react'

interface DashboardProvidersProps {
  contractorId: string
  children: ReactNode
}

/**
 * Inner wrapper that mounts the Realtime subscription exactly once.
 * Placed inside QueryProvider so useQueryClient() is available.
 */
function RealtimeSubscriptions({ contractorId }: { contractorId: string }) {
  // Exactly one Realtime channel subscription per contractor session.
  // NotificationBell is rendered in both Sidebar and BottomTabBar; keeping the
  // subscription here avoids duplicate channel registrations which would crash
  // with "cannot add postgres_changes callbacks after subscribe()".
  useNotificationsSubscription(contractorId)
  return null
}

export function DashboardProviders({ contractorId, children }: DashboardProvidersProps) {
  return (
    <ContractorProvider contractorId={contractorId}>
      <QueryProvider>
        <RealtimeSubscriptions contractorId={contractorId} />
        {children}
      </QueryProvider>
    </ContractorProvider>
  )
}