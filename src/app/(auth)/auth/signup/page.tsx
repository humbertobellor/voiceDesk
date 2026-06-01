// src/app/(auth)/auth/signup/page.tsx
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = { title: 'Create account — Koolable' }

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <SignupForm />
    </main>
  )
}
