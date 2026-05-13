'use client'

import { QueryProvider } from '@/lib/query/provider'
import { ContractorProvider } from '@/contexts/ContractorContext'
import type { ReactNode } from 'react'

interface DashboardProvidersProps {
  contractorId: string
  children: ReactNode
}

export function DashboardProviders({ contractorId, children }: DashboardProvidersProps) {
  return (
    <ContractorProvider contractorId={contractorId}>
      <QueryProvider>
        {children}
      </QueryProvider>
    </ContractorProvider>
  )
}