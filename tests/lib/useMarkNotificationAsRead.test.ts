// tests/lib/useMarkNotificationAsRead.spec.ts
// Phase 17, Plan 04 (Wave 2) — RED tests for useMarkNotificationAsRead hook
// Tests successful mutation, error handling, and loading state.
//
// Requirements: BELL-05 (mark-as-read feature)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the fetch API
global.fetch = vi.fn()

// Mock ContractorContext
vi.mock('@/contexts/ContractorContext', () => ({
  useContractor: () => ({ contractorId: 'contractor-456' }),
}))

// Mock Supabase client
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    from: vi.fn(),
  }),
}))

import { useMarkNotificationAsRead } from '@/lib/query/client'

describe('useMarkNotificationAsRead hook', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  it('successfully marks notification as read and calls API', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper })

    // Trigger mutation with notification ID
    result.current.mutate('notif-789')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify API was called with correct path
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notifications/notif-789/mark-as-read',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('handles error when API call fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      text: async () => 'API Error: Failed to mark notification',
    })

    const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper })

    result.current.mutate('notif-789')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toContain('Failed to mark notification')
  })

  it('shows loading state while mutation is in progress', async () => {
    let resolvePromise: (value: any) => void

    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      })
    )

    const { result } = renderHook(() => useMarkNotificationAsRead(), { wrapper })

    // Trigger mutation
    result.current.mutate('notif-789')

    // Should be pending immediately after mutate is called
    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    // Resolve the fetch promise
    resolvePromise!({ ok: true, json: async () => ({}) })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.isSuccess).toBe(true)
  })
})
