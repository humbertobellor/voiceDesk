// src/app/(auth)/auth/signup/page.tsx
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = { title: 'Create account — VoiceDesk' }

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
      <SignupForm />
    </main>
  )
}
