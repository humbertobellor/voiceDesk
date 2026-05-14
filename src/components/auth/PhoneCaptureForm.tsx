'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { phoneSchema, type PhoneFormData } from '@/lib/validations/onboarding'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PhoneCaptureForm() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: PhoneFormData) => {
    setSubmitError(null)

    // Add timeout to prevent indefinite hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

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

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8">
        <p className="text-sm text-[#94A3B8] mb-2">Step 1 of 1 — Account Setup</p>
        <h1 className="text-[28px] font-semibold text-[#F8FAFC] mb-1">One more thing</h1>
        <p className="text-sm text-[#94A3B8] mb-6">
          We&apos;ll send call alerts to this number. You can change it later in Settings.
        </p>

        {submitError && (
          <div role="alert" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="business_name" className="text-sm text-[#94A3B8]">Business name</Label>
            <Input
              id="business_name"
              placeholder="e.g. South Florida HVAC Co."
              className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] mt-1"
              {...register('business_name')}
            />
            {errors.business_name && <p className="text-sm text-[#EF4444] mt-1">{errors.business_name.message}</p>}
          </div>

          <div>
            <Label htmlFor="phone_number" className="text-sm text-[#94A3B8]">Your mobile number</Label>
            <Input
              id="phone_number"
              type="tel"
              inputMode="tel"
              placeholder="+1 (305) 555-0100"
              className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] mt-1"
              {...register('phone_number')}
            />
            {errors.phone_number ? (
              <p className="text-sm text-[#EF4444] mt-1">{errors.phone_number.message}</p>
            ) : (
              <p className="text-sm text-[#94A3B8] mt-1">US numbers only. We&apos;ll send you call alerts here.</p>
            )}
          </div>

          <div>
            <Label htmlFor="area_code" className="text-sm text-[#94A3B8]">Preferred area code</Label>
            <Input
              id="area_code"
              inputMode="numeric"
              maxLength={3}
              placeholder="305"
              className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] mt-1"
              {...register('area_code')}
            />
            {errors.area_code ? (
              <p className="text-sm text-[#EF4444] mt-1">{errors.area_code.message}</p>
            ) : (
              <p className="text-sm text-[#94A3B8] mt-1">We&apos;ll provision a local VoiceDesk number with this area code.</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="block w-full text-center text-sm text-[#94A3B8] hover:text-[#F8FAFC] mt-4"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
