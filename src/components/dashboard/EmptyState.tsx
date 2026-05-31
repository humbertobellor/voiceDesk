// src/components/dashboard/EmptyState.tsx
// Source: PATTERNS.md EmptyState section + UI-SPEC Surface 3 empty states.
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  body: string
  cta?: { label: string; href: Route }
}

export function EmptyState({ icon: Icon, heading, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] md:min-h-[240px] py-12">
      <Icon size={48} className="text-rule mb-4" />
      <h2 className="text-xl font-semibold text-fg-1 mb-2">{heading}</h2>
      <p className="text-sm text-fg-3 max-w-[320px] text-center mb-6">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="border border-highlight text-highlight px-4 py-2 rounded text-base font-normal min-h-[44px] flex items-center"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}
