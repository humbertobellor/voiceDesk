// src/components/dashboard/SetupBanner.tsx
// Source: PATTERNS.md SetupBanner + UI-SPEC Surface 3.
import Link from 'next/link'

interface SetupBannerProps {
  contractorName?: string | null
}

export function SetupBanner({ contractorName }: SetupBannerProps) {
  const steps = [
    { label: '1. Add phone', complete: true },
    { label: '2. Configure agent', complete: false },
    { label: '3. Connect calendar', complete: false },
    { label: '4. Test call', complete: false },
  ]

  return (
    <div className="bg-[#F97316]/15 border border-[#F97316]/30 rounded-xl p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <p className="text-base font-semibold text-[#F8FAFC]">
            Complete your setup{contractorName ? `, ${contractorName}` : ''}
          </p>
          <p className="text-sm text-[#94A3B8] mt-1">
            Your VoiceDesk receptionist isn&apos;t active yet. Complete these steps to go live.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    step.complete ? 'bg-[#F97316]' : 'bg-[#334155]'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm text-[#94A3B8]">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Link
          href="/settings/agent"
          className="bg-[#F97316] text-[#0F172A] px-3 py-1.5 rounded text-sm font-semibold whitespace-nowrap min-h-[44px] flex items-center justify-center md:w-auto w-full"
        >
          Continue Setup →
        </Link>
      </div>
    </div>
  )
}
