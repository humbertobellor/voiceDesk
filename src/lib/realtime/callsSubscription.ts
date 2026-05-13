'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CallCallback = (callId: string) => void

interface SubscriptionResult {
  isConnected: boolean
}

export function useCallsSubscription(contractorId: string, onNewCall?: CallCallback) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!contractorId) return

    const channel = supabase
      .channel(`calls-realtime-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `contractor_id=eq.${contractorId}`
        },
        (payload) => {
          // New call inserted - invalidate calls query to refetch
          queryClient.invalidateQueries({ queryKey: ['calls'] })
          onNewCall?.(payload.new.id)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          if (process.env.NODE_ENV === 'development') {
            console.log('[Realtime] Calls subscription connected')
          }
        } else {
          setIsConnected(false)
          if (process.env.NODE_ENV === 'development') {
            console.log('[Realtime] Calls subscription status:', status)
          }
        }
      })

    return () => {
      channel.unsubscribe()
      setIsConnected(false)
    }
  }, [contractorId, queryClient, onNewCall])

  return { isConnected }
}