'use client'
// src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
// Source: per D-03 server-action pattern + Plan 03 languageSchema (zod min(1)).
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateLanguages } from '@/app/actions/settings'
import type { Language } from '@/types/database'

const ALL_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
]

interface LanguageSettingsFormProps {
  current: Language[]
}

export function LanguageSettingsForm({ current }: LanguageSettingsFormProps) {
  const [selected, setSelected] = useState<Set<Language>>(new Set(current))
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  function toggle(code: Language) {
    setFeedback(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        // Prevent unchecking the last remaining language (mirrors languageSchema.min(1))
        if (next.size === 1) return prev
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Prevent default so React 19 doesn't auto-reset the form after the action.
    e.preventDefault()
    const supported = Array.from(selected)
    startTransition(async () => {
      const result = await updateLanguages({ supported_languages: supported })
      if (result.ok) {
        setFeedback({ kind: 'success', message: 'Languages updated.' })
      } else {
        setFeedback({ kind: 'error', message: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-elevated border border-rule rounded-xl p-6 max-w-[480px]">
      <fieldset disabled={isPending}>
        <legend className="text-base font-semibold text-fg-on-dark mb-1">Supported languages</legend>
        <p className="text-sm text-fg-3 mb-4">
          Your AI receptionist greets callers in every selected language and lets them choose. At least one language is required.
        </p>
        <div className="space-y-3 mb-6">
          {ALL_LANGUAGES.map(({ code, label }) => {
            const checked = selected.has(code)
            return (
              <Label key={code} htmlFor={`lang-${code}`} className="flex items-center gap-3 cursor-pointer text-fg-on-dark">
                <input
                  id={`lang-${code}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(code)}
                  className="w-4 h-4 accent-highlight"
                />
                <span>{label}</span>
              </Label>
            )
          })}
        </div>
        {feedback && (
          <div
            role="status"
            className={
              feedback.kind === 'success'
                ? 'bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm mb-4'
                : 'bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4'
            }
          >
            {feedback.message}
          </div>
        )}
        <Button
          type="submit"
          disabled={isPending}
          className="bg-highlight text-fg-on-dark hover:bg-highlight/90 min-h-[44px] font-semibold"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save languages'}
        </Button>
      </fieldset>
    </form>
  )
}
