'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState, useRef, useCallback } from 'react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UseTestCallVerificationOptions {
  contractorId: string
  onTestCallDetected?: (callId: string) => void
}

interface TestCallVerificationState {
  isConnected: boolean
  testCallDetected: boolean
  detectedCallId: string | null
  subscriptionStatus: 'connecting' | 'subscribed' | 'unsubscribed' | 'error'
}

/**
 * Hook for subscribing to the calls table to detect test calls.
 * Uses Supabase Realtime with a 5-second polling fallback for reliability.
 *
 * subscriptionStatus is mirrored to a ref so the polling-fallback timeout can
 * read it without being listed as a useEffect dependency (which previously caused
 * an infinite subscribe/unsubscribe loop every time Realtime connected).
 */
export function useTestCallVerification({
  contractorId,
  onTestCallDetected
}: UseTestCallVerificationOptions) {
  const [state, setState] = useState<TestCallVerificationState>({
    isConnected: false,
    testCallDetected: false,
    detectedCallId: null,
    subscriptionStatus: 'connecting'
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Mirror of subscriptionStatus for use inside callbacks without adding state to deps.
  const subscriptionStatusRef = useRef<TestCallVerificationState['subscriptionStatus']>('connecting')

  const setSubscriptionStatus = useCallback((status: TestCallVerificationState['subscriptionStatus']) => {
    subscriptionStatusRef.current = status
    setState(prev => ({ ...prev, subscriptionStatus: status }))
  }, [])

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data: calls, error } = await supabase
          .from('calls')
          .select('id')
          .eq('contractor_id', contractorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) return

        if (calls && calls.id !== lastCallIdRef.current) {
          lastCallIdRef.current = calls.id
          setState(prev => ({
            ...prev,
            testCallDetected: true,
            detectedCallId: calls.id
          }))
          onTestCallDetected?.(calls.id)
        }
      } catch {
        // Continue polling on errors
      }
    }, 5000)
  }, [contractorId, onTestCallDetected])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!contractorId) return

    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    setSubscriptionStatus('connecting')

    const channel = supabase
      .channel(`test-call-verification-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `contractor_id=eq.${contractorId}`
        },
        (payload) => {
          const callId = payload.new.id as string
          lastCallIdRef.current = callId

          setState(prev => ({
            ...prev,
            testCallDetected: true,
            detectedCallId: callId
          }))

          onTestCallDetected?.(callId)
          stopPolling()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isConnected: true }))
          setSubscriptionStatus('subscribed')

          if (process.env.NODE_ENV === 'development') {
            console.log('[TestCallVerification] Realtime subscription connected')
          }
        } else if (status === 'CHANNEL_ERROR') {
          setState(prev => ({ ...prev, isConnected: false }))
          setSubscriptionStatus('error')
          startPolling()

          if (process.env.NODE_ENV === 'development') {
            console.log('[TestCallVerification] Realtime error, using polling fallback')
          }
        } else if (status === 'CLOSED') {
          setState(prev => ({ ...prev, isConnected: false }))
          setSubscriptionStatus('unsubscribed')
        }
      })

    channelRef.current = channel

    // Start polling fallback if Realtime hasn't connected within 5 seconds.
    // Uses the ref to read current status without adding state to this effect's deps.
    const pollingFallbackTimeout = setTimeout(() => {
      if (subscriptionStatusRef.current !== 'subscribed') {
        startPolling()
      }
    }, 5000)

    return () => {
      channel.unsubscribe()
      stopPolling()
      clearTimeout(pollingFallbackTimeout)
      setSubscriptionStatus('unsubscribed')
    }
  }, [contractorId, onTestCallDetected, startPolling, stopPolling, setSubscriptionStatus])

  return {
    isConnected: state.isConnected,
    testCallDetected: state.testCallDetected,
    detectedCallId: state.detectedCallId,
    subscriptionStatus: state.subscriptionStatus
  }
}
