// src/app/(auth)/auth/signup/page.tsx
import { SignupForm } from '@/components/auth/SignupForm'
import { Logo } from '@/components/ui/Logo'

export const metadata = { title: 'Create account — Koolable' }

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <Logo size="xl" />
        </div>
        <SignupForm />
      </div>
    </main>
  )
}
