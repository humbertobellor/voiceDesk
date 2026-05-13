'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type LeadCallback = (leadId: string) => void

export function useLeadsSubscription(contractorId: string, onNewLead?: LeadCallback) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!contractorId) return

    const channel = supabase
      .channel(`leads-realtime-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `contractor_id=eq.${contractorId}`
        },
        (payload) => {
          // New lead inserted - invalidate leads query to refetch
          queryClient.invalidateQueries({ queryKey: ['leads'] })
          onNewLead?.(payload.new.id)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          if (process.env.NODE_ENV === 'development') {
            console.log('[Realtime] Leads subscription connected')
          }
        } else {
          setIsConnected(false)
          if (process.env.NODE_ENV === 'development') {
            console.log('[Realtime] Leads subscription status:', status)
          }
        }
      })

    return () => {
      channel.unsubscribe()
      setIsConnected(false)
    }
  }, [contractorId, queryClient, onNewLead])

  return { isConnected }
}