import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@supabase/ssr'
import { useContractor } from '@/contexts/ContractorContext'
import type { Call, Lead, ContractorSettings, LeadStatus, TradeType } from '@/types/database'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============ CALLS HOOKS ============

export function useCalls(page = 1, limit = 50) {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['calls', contractorId, page, limit],
    queryFn: async (): Promise<{ calls: Call[]; total: number }> => {
      if (!contractorId) throw new Error('No contractor ID')

      const offset = (page - 1) * limit

      const [callsResult, countResult] = await Promise.all([
        supabase
          .from('calls')
          .select('*', { count: 'exact' })
          .eq('contractor_id', contractorId)
          .order('started_at', { ascending: false })
          .range(offset, offset + limit - 1),
        supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('contractor_id', contractorId)
      ])

      if (callsResult.error) throw callsResult.error

      return {
        calls: (callsResult.data ?? []) as Call[],
        total: countResult.count ?? 0
      }
    },
    enabled: !!contractorId
  })
}

export function useCallById(callId: string) {
  return useQuery({
    queryKey: ['call', callId],
    queryFn: async (): Promise<Call | null> => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single()

      if (error) throw error
      return data as Call
    },
    enabled: !!callId
  })
}

export function useCallsCount() {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['calls', 'count', contractorId],
    queryFn: async (): Promise<number> => {
      if (!contractorId) throw new Error('No contractor ID')

      const { count, error } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)

      if (error) throw error
      return count ?? 0
    },
    enabled: !!contractorId
  })
}

// ============ LEADS HOOKS ============

export interface LeadFilters {
  status?: LeadStatus[]
  dateFrom?: string
  dateTo?: string
  serviceType?: TradeType[]
}

export function useLeads(filters?: LeadFilters, page = 1, limit = 50) {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['leads', contractorId, filters, page, limit],
    queryFn: async (): Promise<{ leads: Lead[]; total: number }> => {
      if (!contractorId) throw new Error('No contractor ID')

      const offset = (page - 1) * limit

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('contractor_id', contractorId)

      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }
      if (filters?.serviceType?.length) {
        query = query.in('service_type', filters.serviceType)
      }

      // Get leads with pagination
      const leadsResult = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (leadsResult.error) throw leadsResult.error

      // Get total count with same filters
      let countQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)

      if (filters?.status?.length) {
        countQuery = countQuery.in('status', filters.status)
      }
      if (filters?.dateFrom) {
        countQuery = countQuery.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        countQuery = countQuery.lte('created_at', filters.dateTo)
      }
      if (filters?.serviceType?.length) {
        countQuery = countQuery.in('service_type', filters.serviceType)
      }

      const countResult = await countQuery

      return {
        leads: (leadsResult.data ?? []) as Lead[],
        total: countResult.count ?? 0
      }
    },
    enabled: !!contractorId
  })
}

export function useLeadsCount(filters?: LeadFilters) {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['leads', 'count', contractorId, filters],
    queryFn: async (): Promise<number> => {
      if (!contractorId) throw new Error('No contractor ID')

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)

      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }
      if (filters?.serviceType?.length) {
        query = query.in('service_type', filters.serviceType)
      }

      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    },
    enabled: !!contractorId
  })
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: LeadStatus }) => {
      // defense-in-depth: RLS enforces same constraint, but explicit filter provides double safety
      const query = supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId)

      const finalQuery = contractorId
        ? query.eq('contractor_id', contractorId)
        : query

      const { data, error } = await finalQuery
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    }
  })
}

export function useLeadById(leadId: string) {
  return useQuery({
    queryKey: ['lead', leadId],
    queryFn: async (): Promise<Lead | null> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (error) throw error
      return data as Lead
    },
    enabled: !!leadId
  })
}

// ============ CONTRACTOR SETTINGS HOOKS ============

export function useContractorSettings() {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['contractorSettings', contractorId],
    queryFn: async (): Promise<ContractorSettings | null> => {
      if (!contractorId) throw new Error('No contractor ID')

      const { data, error } = await supabase
        .from('contractor_settings')
        .select('*')
        .eq('contractor_id', contractorId)
        .single()

      if (error) throw error
      return data as ContractorSettings
    },
    enabled: !!contractorId
  })
}

export function useUpdateContractorSettings() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async (updates: Partial<ContractorSettings>) => {
      if (!contractorId) throw new Error('No contractor ID')

      const { data, error } = await supabase
        .from('contractor_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('contractor_id', contractorId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      if (contractorId) {
        queryClient.invalidateQueries({ queryKey: ['contractorSettings', contractorId] })
      }
    }
  })
}

export function useSyncRetellAgent() {
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')

      const response = await fetch('/api/provisioning/update-agent', {
        method: 'PATCH',
      })
      if (!response.ok) throw new Error('Failed to sync Retell agent')
      return response.json()
    }
  })
}

// ============ RECORDINGS HOOKS ============

export function useCallRecordingUrl(callId: string) {
  return useQuery({
    queryKey: ['recordingUrl', callId],
    queryFn: async (): Promise<string | null> => {
      const response = await fetch(`/api/recordings?callId=${callId}`)
      if (!response.ok) return null
      const data = await response.json()
      return data.signedUrl ?? null
    },
    enabled: !!callId,
    staleTime: 30 * 1000 // 30 seconds - URL is valid for 60s
  })
}