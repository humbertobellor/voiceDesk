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
 * @param contractorId - The contractor ID to filter calls by
 * @param onTestCallDetected - Callback when a test call is detected
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

  // Poll for new calls as fallback (every 5 seconds)
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

        if (error) {
          // Ignore errors during polling, continue
          return
        }

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

    // Clean up previous channel if exists
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    setState(prev => ({ ...prev, subscriptionStatus: 'connecting' }))

    // Set up Supabase Realtime subscription
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
          // Test call detected via Realtime
          const callId = payload.new.id as string
          lastCallIdRef.current = callId

          setState(prev => ({
            ...prev,
            testCallDetected: true,
            detectedCallId: callId
          }))

          onTestCallDetected?.(callId)

          // Stop polling since we got the event via Realtime
          stopPolling()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({
            ...prev,
            isConnected: true,
            subscriptionStatus: 'subscribed'
          }))

          if (process.env.NODE_ENV === 'development') {
            console.log('[TestCallVerification] Realtime subscription connected')
          }
        } else if (status === 'CHANNEL_ERROR') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            subscriptionStatus: 'error'
          }))

          // Start polling fallback on error
          startPolling()

          if (process.env.NODE_ENV === 'development') {
            console.log('[TestCallVerification] Realtime error, using polling fallback')
          }
        } else if (status === 'CLOSED') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            subscriptionStatus: 'unsubscribed'
          }))
        }
      })

    channelRef.current = channel

    // Fallback: also start polling in case Realtime doesn't connect within 5 seconds
    const pollingFallbackTimeout = setTimeout(() => {
      if (state.subscriptionStatus !== 'subscribed') {
        startPolling()
      }
    }, 5000)

    return () => {
      channel.unsubscribe()
      stopPolling()
      clearTimeout(pollingFallbackTimeout)
      setState(prev => ({
        ...prev,
        subscriptionStatus: 'unsubscribed'
      }))
    }
  }, [contractorId, onTestCallDetected, startPolling, stopPolling, state.subscriptionStatus])

  return {
    isConnected: state.isConnected,
    testCallDetected: state.testCallDetected,
    detectedCallId: state.detectedCallId,
    subscriptionStatus: state.subscriptionStatus
  }
}