'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme/context'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <fieldset className="flex gap-2">
      <legend className="sr-only">Theme</legend>
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
            theme === value
              ? 'bg-accent text-fg-on-dark'
              : 'bg-bg-sunken text-fg-2 hover:bg-vellum-200'
          }`}
          title={label}
        >
          <Icon size={16} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </fieldset>
  )
}
