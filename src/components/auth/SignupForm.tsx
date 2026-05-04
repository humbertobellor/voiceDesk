'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { signupSchema, type SignupFormData } from '@/lib/validations/onboarding'

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline', // Phase 4 calendar refresh tokens
          prompt: 'consent',      // forces refresh_token on every re-auth
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
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signUp({
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
    // Auto-logged-in after signUp (no email confirmation in dev); redirect to phone capture
    window.location.href = '/setup/phone'
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8">
        <h1 className="text-[28px] font-semibold text-[#F8FAFC] mb-1">Create your account</h1>
        <p className="text-sm text-[#94A3B8] mb-6">Start answering calls in minutes</p>

        {submitError && (
          <div role="alert" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4">
            {submitError}
          </div>
        )}

        {/* D-01 PRIMARY: Google OAuth, full-width orange CTA */}
        <Button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
          className="w-full bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Sign up with Google'
          )}
        </Button>

        {/* "or continue with email" divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-[#334155]" />
          <span className="mx-3 text-sm text-[#94A3B8]">or continue with email</span>
          <div className="flex-1 border-t border-[#334155]" />
        </div>

        {/* D-01 SECONDARY: email/password */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm text-[#94A3B8]">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] mt-1"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-[#EF4444] mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="password" className="text-sm text-[#94A3B8]">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-[#EF4444] mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-sm text-[#94A3B8]">Confirm password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] pr-10"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-sm text-[#EF4444] mt-1">{errors.confirmPassword.message}</p>}
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
