'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Eye, EyeOff, Check, X, AlertCircle, MailCheck } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { signupSchema, type SignupFormData } from '@/lib/validations/onboarding'

const SUBMIT_TIMEOUT_MS = 15_000

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${met ? 'text-success' : 'text-fg-3'}`}>
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
  // Covers both the zod-validation phase (<100 ms) and the async Supabase call.
  // Controlled entirely by us so a hanging network request can never freeze it.
  const [buttonPending, setButtonPending] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields, isSubmitted },
  } = useForm<SignupFormData>({
    // Custom resolver: @hookform/resolvers/zod targets Zod v3 and checks
    // ZodError.errors (removed in v4). This adapter reads ZodError.issues,
    // which is the only property Zod v4 exposes.
    resolver: async (values) => {
      const result = signupSchema.safeParse(values)
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
    // onTouched: show error on first blur, then re-validate on every keystroke
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  })

  const passwordValue = watch('password') ?? ''
  const showPasswordHints = touchedFields.password || isSubmitted
  // Banner shown after a failed submit attempt (independent of the loading state)
  const hasFieldErrors = isSubmitted && !buttonPending && Object.keys(errors).length > 0

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
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      setIsGoogleLoading(false)
      setSubmitError('Sign-up failed. Google returned an error. Please try again or use email and password.')
    }
  }

  // Called only when zod validation passes.
  const onSubmit = async (data: SignupFormData) => {
    setSubmitError(null)
    try {
      const supabase = createSupabaseBrowser()

      // Promise.race ensures onSubmit always resolves within SUBMIT_TIMEOUT_MS.
      // If the Supabase call never responds, the race rejects and the catch block
      // cleans up — no frozen spinner.
      const { data: signUpData, error } = await Promise.race([
        supabase.auth.signUp({ email: data.email, password: data.password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), SUBMIT_TIMEOUT_MS)
        ),
      ])

      if (error) {
        if (
          error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already exists')
        ) {
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
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'timeout'
      setSubmitError(
        isTimeout
          ? 'Request timed out. Please check your connection and try again.'
          : 'Something went wrong. Please check your connection and try again.'
      )
    }
  }

  // Wrapper that sets buttonPending for the full submit lifecycle:
  // zod validation + (if valid) the async Supabase call.
  const handleFormSubmit: React.FormEventHandler = async (e) => {
    setButtonPending(true)
    try {
      await handleSubmit(onSubmit)(e)
    } finally {
      setButtonPending(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="w-full max-w-[400px] mx-auto">
        <div className="bg-bg-elevated border border-rule rounded-xl p-8 text-center">
          <MailCheck size={48} className="mx-auto mb-4 text-highlight" />
          <h1 className="text-[22px] font-semibold text-fg-on-dark mb-2">Check your email</h1>
          <p className="text-sm text-fg-3 mb-4">
            We sent a confirmation link to <span className="text-fg-on-dark">{confirmedEmail}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/auth/login" className="text-sm text-highlight hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="bg-bg-elevated border border-rule rounded-xl p-8">
        <h1 className="text-[28px] font-semibold text-fg-on-dark mb-1">Create your account</h1>
        <p className="text-sm text-fg-3 mb-6">Start answering calls in minutes</p>

        {/* API / network error */}
        {submitError && (
          <div role="alert" className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Form-level validation summary shown after a failed submit */}
        {hasFieldErrors && !submitError && (
          <div role="alert" className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            Please fix the highlighted fields below.
          </div>
        )}

        <Button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
          className="w-full bg-highlight text-bg hover:bg-highlight/90 min-h-[44px] font-semibold"
        >
          {isGoogleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign up with Google'}
        </Button>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-rule" />
          <span className="mx-3 text-sm text-fg-3">or continue with email</span>
          <div className="flex-1 border-t border-rule" />
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-sm text-fg-3">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`mt-1 bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] transition-colors ${
                errors.email
                  ? 'border-danger focus-visible:ring-danger'
                  : 'border-rule'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-sm text-fg-3">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="password-requirements"
                className={`bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] pr-10 transition-colors ${
                  errors.password
                    ? 'border-danger focus-visible:ring-danger'
                    : 'border-rule'
                }`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-on-dark"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
            <Label htmlFor="confirmPassword" className="text-sm text-fg-3">Confirm password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                className={`bg-bg text-fg-on-dark focus-visible:ring-accent min-h-[44px] pr-10 transition-colors ${
                  errors.confirmPassword
                    ? 'border-danger focus-visible:ring-danger'
                    : 'border-rule'
                }`}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-on-dark"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" role="alert" className="text-sm text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={buttonPending}
            className="w-full border-rule text-fg-on-dark hover:bg-rule min-h-[44px]"
          >
            {buttonPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-fg-3">
          <Link href="/auth/login" className="text-highlight hover:underline">
            Already have an account? Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
