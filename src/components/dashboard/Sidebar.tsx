'use client'
// src/components/dashboard/Sidebar.tsx
// Source: PATTERNS.md Sidebar + UI-SPEC Surface 3.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PhoneCall, Users, Settings, Bot, Bell, CreditCard, LogOut, Mic, Phone, Calendar, Radio, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import type { Route } from 'next'
import { NotificationBell } from '@/components/notification/NotificationBell'

interface SidebarProps {
  businessName?: string | null
  userEmail?: string | null
  phoneNumber?: string | null
}

const mainNav = [
  { href: '/calls' as Route, icon: PhoneCall, label: 'Calls' },
  { href: '/leads' as Route, icon: Users, label: 'Leads' },
  { href: '/settings/agent' as Route, icon: Settings, label: 'Settings' },
]

const settingsSubNav = [
  { href: '/settings/agent' as Route, icon: Bot, label: 'Agent Config' },
  { href: '/settings/calendar' as Route, icon: Calendar, label: 'Calendar' },
  { href: '/settings/phone' as Route, icon: Phone, label: 'Phone' },
  { href: '/settings/go-live' as Route, icon: Radio, label: 'Go Live' },
  { href: '/settings/account' as Route, icon: CreditCard, label: 'Account & Billing' },
  { href: '/settings/notifications' as Route, icon: Bell, label: 'Notifications' },
  { href: '/settings/appearance' as Route, icon: Palette, label: 'Appearance' },
]

export function Sidebar({ businessName, userEmail, phoneNumber }: SidebarProps) {
  const pathname = usePathname()
  const onSettings = pathname.startsWith('/settings')

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <aside
      className="w-60 h-screen fixed bg-bg border-r border-rule flex-col hidden md:flex"
      aria-label="Primary"
    >
      {/* Logo area */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-rule">
        <Mic size={20} className="text-highlight" />
        <span className="text-xl font-semibold text-fg-1">Koolable</span>
        <NotificationBell className="ml-auto" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-6">
        <p className="text-sm font-semibold text-fg-3 tracking-wider px-4 mb-2">NAVIGATION</p>
        {mainNav.map(({ href, icon: Icon, label }) => {
          const isActive =
            label === 'Settings'
              ? pathname.startsWith('/settings')
              : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 py-3 rounded-lg mx-2 min-h-[48px]',
                isActive
                  ? 'bg-accent/10 text-accent font-medium px-4'
                  : 'text-fg-3 px-4 hover:bg-bg-elevated hover:text-fg-1'
              )}
            >
              <Icon size={20} />
              <span className={isActive ? 'font-medium' : 'font-normal'}>{label}</span>
            </Link>
          )
        })}

        {/* Settings sub-nav (only when on /settings/*) */}
        {onSettings && (
          <div className="ml-6 mt-2 border-l border-rule pl-2">
            {settingsSubNav.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 py-2 rounded-lg mx-1 min-h-[40px] text-sm',
                    isActive
                      ? 'text-highlight font-semibold'
                      : 'text-fg-3 hover:text-fg-1'
                  )}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* User area */}
      <div className="border-t border-rule p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-rule flex items-center justify-center text-sm font-semibold text-fg-1">
            {(businessName?.[0] ?? userEmail?.[0] ?? 'V').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-fg-1 truncate">{businessName ?? 'Koolable'}</p>
            {phoneNumber && (
              <p className="text-xs font-mono text-fg-3 flex items-center gap-1 truncate">
                <Phone size={10} />
                {phoneNumber}
              </p>
            )}
            <p className="text-xs text-fg-3 truncate">{userEmail ?? ''}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-fg-3 hover:text-fg-1"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
