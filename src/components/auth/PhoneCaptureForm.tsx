'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, AlertCircle } from 'lucide-react'
import { phoneSchema, type PhoneFormData } from '@/lib/validations/onboarding'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PhoneCaptureForm() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [buttonPending, setButtonPending] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<PhoneFormData>({
    // Inline Zod v4-compatible resolver — @hookform/resolvers/zod@3.10.0 checks
    // ZodError.errors which was removed in Zod v4; only ZodError.issues exists now.
    resolver: async (values) => {
      const result = phoneSchema.safeParse(values)
      if (result.success) return { values: result.data, errors: {} }
      const fieldErrors: Record<string, { type: string; message: string }> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!fieldErrors[path]) {
          fieldErrors[path] = { type: issue.code, message: issue.message }
        }
      }
      return { values: {}, errors: fieldErrors }
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  })

  const onSubmit = async (data: PhoneFormData) => {
    setSubmitError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch('/api/onboarding/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitError(body.error ?? 'Something went wrong. Please try again.')
        return
      }
      window.location.href = '/pricing'
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        setSubmitError('Request timed out. Please try again.')
      } else {
        setSubmitError('Network error. Please check your connection and try again.')
      }
    }
  }

  const handleFormSubmit: React.FormEventHandler = async (e) => {
    setButtonPending(true)
    try {
      await handleSubmit(onSubmit)(e)
    } finally {
      setButtonPending(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="bg-bg-elevated border border-rule rounded-xl p-8">
        <p className="text-sm text-fg-3 mb-2">Step 1 of 1 — Account Setup</p>
        <h1 className="text-[28px] font-semibold text-fg-on-dark mb-1">One more thing</h1>
        <p className="text-sm text-fg-3 mb-6">
          We'll send call alerts to this number. You can change it later in Settings.
        </p>

        {submitError && (
          <div role="alert" className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
          {/* Business name */}
          <div>
            <Label htmlFor="business_name" className="text-sm text-fg-3">Business name</Label>
            <Input
              id="business_name"
              placeholder="e.g. South Florida HVAC Co."
              aria-invalid={!!errors.business_name}
              aria-describedby={errors.business_name ? 'business-name-error' : undefined}
              className={`mt-1 bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] transition-colors ${
                errors.business_name
                  ? 'border-danger focus-visible:ring-danger'
                  : 'border-rule'
              }`}
              {...register('business_name')}
            />
            {errors.business_name && (
              <p id="business-name-error" role="alert" className="text-sm text-danger mt-1 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.business_name.message}
              </p>
            )}
          </div>

          {/* Phone number */}
          <div>
            <Label htmlFor="phone_number" className="text-sm text-fg-3">Your mobile number</Label>
            <Input
              id="phone_number"
              type="tel"
              inputMode="tel"
              placeholder="+1 (305) 555-0100"
              aria-invalid={!!errors.phone_number}
              aria-describedby={errors.phone_number ? 'phone-number-error' : 'phone-number-hint'}
              className={`mt-1 bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] transition-colors ${
                errors.phone_number
                  ? 'border-danger focus-visible:ring-danger'
                  : 'border-rule'
              }`}
              {...register('phone_number')}
            />
            {errors.phone_number ? (
              <p id="phone-number-error" role="alert" className="text-sm text-danger mt-1 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.phone_number.message}
              </p>
            ) : (
              <p id="phone-number-hint" className="text-sm text-fg-3 mt-1">
                US numbers only. We'll send you call alerts here.
              </p>
            )}
          </div>

          {/* Area code */}
          <div>
            <Label htmlFor="area_code" className="text-sm text-fg-3">Preferred area code</Label>
            <Input
              id="area_code"
              inputMode="numeric"
              maxLength={3}
              placeholder="305"
              aria-invalid={!!errors.area_code}
              aria-describedby={errors.area_code ? 'area-code-error' : 'area-code-hint'}
              className={`mt-1 bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] transition-colors ${
                errors.area_code
                  ? 'border-danger focus-visible:ring-danger'
                  : 'border-rule'
              }`}
              {...register('area_code')}
            />
            {errors.area_code ? (
              <p id="area-code-error" role="alert" className="text-sm text-danger mt-1 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.area_code.message}
              </p>
            ) : (
              <p id="area-code-hint" className="text-sm text-fg-3 mt-1">
                We'll provision a local VoiceDesk number with this area code.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={buttonPending}
            className="w-full bg-highlight text-fg-on-dark hover:bg-highlight/90 min-h-[44px] font-semibold"
          >
            {buttonPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="block w-full text-center text-sm text-fg-3 hover:text-fg-on-dark mt-4"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
