'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface ContractorContextType {
  contractorId: string | null
}

const ContractorContext = createContext<ContractorContextType>({
  contractorId: null
})

export function useContractor() {
  return useContext(ContractorContext)
}

interface ContractorProviderProps {
  contractorId: string | null
  children: ReactNode
}

export function ContractorProvider({ contractorId, children }: ContractorProviderProps) {
  return (
    <ContractorContext.Provider value={{ contractorId }}>
      {children}
    </ContractorContext.Provider>
  )
}