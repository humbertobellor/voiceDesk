'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { signupSchema, type SignupFormData } from '@/lib/validations/onboarding'

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${met ? 'text-[#22C55E]' : 'text-[#94A3B8]'}`}>
      {met ? <Check size={12} /> : <X size={12} />}
      {label}
    </span>
  )
}

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields, isSubmitted },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    shouldFocusError: true,
  })

  const passwordValue = watch('password') ?? ''
  const showPasswordHints = touchedFields.password || isSubmitted
  const hasFieldErrors = isSubmitted && !isSubmitting && Object.keys(errors).length > 0

  const passwordChecks = {
    length: passwordValue.length >= 8,
    uppercase: /[A-Z]/.test(passwordValue),
    number: /[0-9]/.test(passwordValue),
  }

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      setIsGoogleLoading(false)
      setSubmitError('Sign-up failed. Google returned an error. Please try again or use email and password.')
    }
  }

  const onSubmit = async (data: SignupFormData) => {
    setSubmitError(null)
    try {
      const supabase = createSupabaseBrowser()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })
      if (error) {
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          setSubmitError('An account with this email already exists. Sign in instead.')
        } else {
          setSubmitError(error.message)
        }
        return
      }
      if (!signUpData.session) {
        setConfirmedEmail(data.email)
        setConfirmationSent(true)
        return
      }
      window.location.href = '/setup/phone'
    } catch {
      setSubmitError('Something went wrong. Please check your connection and try again.')
    }
  }

  if (confirmationSent) {
    return (
      <div className="w-full max-w-[400px] mx-auto">
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="text-[22px] font-semibold text-[#F8FAFC] mb-2">Check your email</h1>
          <p className="text-sm text-[#94A3B8] mb-4">
            We sent a confirmation link to <span className="text-[#F8FAFC]">{confirmedEmail}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/auth/login" className="text-sm text-[#F97316] hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8">
        <h1 className="text-[28px] font-semibold text-[#F8FAFC] mb-1">Create your account</h1>
        <p className="text-sm text-[#94A3B8] mb-6">Start answering calls in minutes</p>

        {/* Supabase / network errors */}
        {submitError && (
          <div role="alert" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Form-level validation summary — shown after a failed submit */}
        {hasFieldErrors && !submitError && (
          <div role="alert" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            Please fix the highlighted fields below.
          </div>
        )}

        <Button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
          className="w-full bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold"
        >
          {isGoogleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign up with Google'}
        </Button>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-[#334155]" />
          <span className="mx-3 text-sm text-[#94A3B8]">or continue with email</span>
          <div className="flex-1 border-t border-[#334155]" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-sm text-[#94A3B8]">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`mt-1 bg-[#0F172A] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] transition-colors ${
                errors.email
                  ? 'border-[#EF4444] focus-visible:ring-[#EF4444]'
                  : 'border-[#334155]'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-[#EF4444] mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-sm text-[#94A3B8]">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="password-requirements"
                className={`bg-[#0F172A] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] pr-10 transition-colors ${
                  errors.password
                    ? 'border-[#EF4444] focus-visible:ring-[#EF4444]'
                    : 'border-[#334155]'
                }`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Requirements: show once field is touched OR after a submit attempt */}
            {showPasswordHints && (
              <div id="password-requirements" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <PasswordRequirement met={passwordChecks.length} label="8+ characters" />
                <PasswordRequirement met={passwordChecks.uppercase} label="Uppercase letter" />
                <PasswordRequirement met={passwordChecks.number} label="One number" />
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <Label htmlFor="confirmPassword" className="text-sm text-[#94A3B8]">Confirm password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                className={`bg-[#0F172A] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] pr-10 transition-colors ${
                  errors.confirmPassword
                    ? 'border-[#EF4444] focus-visible:ring-[#EF4444]'
                    : 'border-[#334155]'
                }`}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" role="alert" className="text-sm text-[#EF4444] mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting}
            className="w-full border-[#334155] text-[#F8FAFC] hover:bg-[#334155] min-h-[44px]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-[#94A3B8]">
          <Link href="/auth/login" className="text-[#F97316] hover:underline">
            Already have an account? Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
