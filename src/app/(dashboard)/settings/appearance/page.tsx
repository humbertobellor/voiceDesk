import { ThemeToggle } from '@/components/theme/ThemeToggle'

export const metadata = { title: 'Appearance — Koolable' }

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-1 mb-1">Appearance</h1>
        <p className="text-sm text-fg-3">Customize how Koolable looks</p>
      </div>

      <div className="bg-bg-elevated border border-rule rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-fg-1 mb-3">Theme</label>
            <p className="text-sm text-fg-3 mb-4">Choose your preferred color scheme</p>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
