// tests/components/NotificationBell.test.tsx
// Phase 17, Plan 05 (Wave 3) — Comprehensive component tests for NotificationBell
// Tests icon visibility, badge rendering, popover open/close, notification list rendering,
// mark-all-read button, empty state, Realtime subscription updates, and focus management.
//
// Requirements: BELL-01 (icon/badge), BELL-02 (popover), BELL-03 (mark-all-read)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the hooks
vi.mock('@/lib/query/client', () => ({
  useNotifications: vi.fn(),
  useUnreadCount: vi.fn(),
  useMarkAllRead: vi.fn(),
  useMarkNotificationAsRead: vi.fn(),
}))

// Mock Supabase Realtime to avoid actual subscriptions
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    })),
  }),
}))

import { NotificationBell } from '@/components/notification/NotificationBell'
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkNotificationAsRead,
} from '@/lib/query/client'
import type { AppNotification } from '@/types/database'

describe('NotificationBell', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Default mock implementations
    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    ;(useUnreadCount as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 0,
      isLoading: false,
      error: null,
    })

    ;(useMarkAllRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    })

    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    })
  })

  const renderNotificationBell = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
      </QueryClientProvider>
    )
  }

  // Test 1: Bell icon renders
  it('should render Bell icon', () => {
    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    expect(bellButton).toBeInTheDocument()

    // Verify the bell icon is present by checking the button's child elements
    expect(bellButton.querySelector('svg')).toBeInTheDocument()
  })

  // Test 2: Badge shows unread count when > 0
  it('should display unread count badge when count > 0', () => {
    ;(useUnreadCount as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 5,
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const badge = screen.getByLabelText(/5 unread notifications/i)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('5')
  })

  // Test 3: Badge hidden when count is 0
  it('should not display badge when unread count is 0', () => {
    ;(useUnreadCount as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 0,
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    // The badge element should not be in the document
    const badge = screen.queryByLabelText(/unread notifications/i)
    expect(badge).not.toBeInTheDocument()
  })

  // Test 4: Popover opens on button click
  it('should open popover when Bell button is clicked', async () => {
    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Test Notification',
          body: 'Test body',
          is_read: false,
          created_at: new Date().toISOString(),
          event_type: 'lead',
          contractor_id: 'test-contractor',
        } as AppNotification,
      ],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellButton)

    await waitFor(() => {
      // Verify popover content is visible
      const notificationsHeader = screen.getByText('Notifications')
      expect(notificationsHeader).toBeInTheDocument()
    })
  })

  // Test 5: Popover closes on Escape key
  it('should close popover when Escape key is pressed', async () => {
    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Test Notification',
          body: 'Test body',
          is_read: false,
          created_at: new Date().toISOString(),
          event_type: 'lead',
          contractor_id: 'test-contractor',
        } as AppNotification,
      ],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })

    // Open popover
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Close with Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      // Verify popover is closed by checking if the header is no longer visible
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    })
  })

  // Test 6: Notification list renders
  it('should display notification list in popover', async () => {
    const mockNotifications: AppNotification[] = [
      {
        id: '1',
        title: 'New Lead',
        body: 'Lead from John',
        is_read: false,
        created_at: new Date().toISOString(),
        event_type: 'lead',
        contractor_id: 'test-contractor',
      } as AppNotification,
      {
        id: '2',
        title: 'Missed Call',
        body: 'Call from Jane',
        is_read: false,
        created_at: new Date().toISOString(),
        event_type: 'system',
        contractor_id: 'test-contractor',
      } as AppNotification,
    ]

    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockNotifications,
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('New Lead')).toBeInTheDocument()
      expect(screen.getByText('Missed Call')).toBeInTheDocument()
      expect(screen.getByText('Lead from John')).toBeInTheDocument()
      expect(screen.getByText('Call from Jane')).toBeInTheDocument()
    })
  })

  // Test 7: Empty state displays when no notifications
  it('should display empty state when no notifications exist', async () => {
    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    })
  })

  // Test 8: Mark-all-read button calls mutation
  it('should call useMarkAllRead.mutate() when mark-all-read button is clicked', async () => {
    const mockMutate = vi.fn()
    ;(useMarkAllRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    })

    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Test Notification',
          body: 'Test body',
          is_read: false,
          created_at: new Date().toISOString(),
          event_type: 'lead',
          contractor_id: 'test-contractor',
        } as AppNotification,
      ],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })

    const markAllReadButton = screen.getByRole('button', { name: /mark all read/i })
    fireEvent.click(markAllReadButton)

    expect(mockMutate).toHaveBeenCalled()
  })

  // Test 9: Realtime subscription updates badge count
  it('should update badge count when Realtime notification arrives', async () => {
    const { rerender } = renderNotificationBell()

    // Initial state: 0 unread
    let badge = screen.queryByLabelText(/unread notifications/i)
    expect(badge).not.toBeInTheDocument()

    // Simulate Realtime update: increment to 3
    ;(useUnreadCount as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 3,
      isLoading: false,
      error: null,
    })

    rerender(
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
      </QueryClientProvider>
    )

    await waitFor(() => {
      badge = screen.getByLabelText(/3 unread notifications/i)
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('3')
    })
  })

  // Test 10: Focus returns to Bell button after popover closes
  it('should return focus to Bell button when popover closes', async () => {
    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: '1',
          title: 'Test Notification',
          body: 'Test body',
          is_read: false,
          created_at: new Date().toISOString(),
          event_type: 'lead',
          contractor_id: 'test-contractor',
        } as AppNotification,
      ],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })

    // Focus the bell button
    bellButton.focus()
    expect(document.activeElement).toBe(bellButton)

    // Open popover
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Close popover with Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      // Focus should return to bell button (Radix UI Popover manages this)
      expect(document.activeElement).toBe(bellButton)
    })
  })

  // Test 11: Badge caps at 99+ for large unread counts
  it('should display 99+ when unread count exceeds 99', () => {
    ;(useUnreadCount as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 150,
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const badge = screen.getByLabelText(/150 unread notifications/i)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('99+')
  })

  // Test 12: Mark-as-read button on individual notifications works
  it('should call mutate when individual notification mark-as-read button is clicked', async () => {
    const mockMarkAsReadMutate = vi.fn()
    ;(useMarkNotificationAsRead as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMarkAsReadMutate,
      isPending: false,
      isError: false,
    })

    ;(useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: 'notif-123',
          title: 'Test Notification',
          body: 'Test body',
          is_read: false,
          created_at: new Date().toISOString(),
          event_type: 'lead',
          contractor_id: 'test-contractor',
        } as AppNotification,
      ],
      isLoading: false,
      error: null,
    })

    renderNotificationBell()

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Test Notification')).toBeInTheDocument()
    })

    // Find the mark-as-read button for this notification (CheckCircle icon button)
    const markAsReadButtons = screen.getAllByLabelText(/mark.*as read/i)
    expect(markAsReadButtons.length).toBeGreaterThan(0)

    fireEvent.click(markAsReadButtons[0])

    expect(mockMarkAsReadMutate).toHaveBeenCalledWith('notif-123')
  })
})
