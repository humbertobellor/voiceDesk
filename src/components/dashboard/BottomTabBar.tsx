'use client'
// src/components/dashboard/BottomTabBar.tsx
// Source: UI-SPEC Surface 3 §Responsive Behavior.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PhoneCall, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notification/NotificationBell'
import type { Route } from 'next'

const tabs: { href: Route; icon: typeof PhoneCall; label: string }[] = [
  { href: '/calls', icon: PhoneCall, label: 'Calls' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/settings/agent', icon: Settings, label: 'Settings' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed bottom-0 left-0 right-0 h-14 bg-bg border-t border-rule flex md:hidden z-30"
    >
      {tabs.map(({ href, icon: Icon, label }) => {
        const isActive =
          href === '/settings/agent'
            ? pathname.startsWith('/settings')
            : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px]',
              isActive ? 'text-highlight' : 'text-fg-3'
            )}
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-fg-3">
        <NotificationBell />
        <span className="text-xs">Alerts</span>
      </div>
    </nav>
  )
}
