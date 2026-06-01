// src/app/(auth)/auth/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign in — Koolable' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMessages: Record<string, string> = {
    no_code: 'Sign-in failed. The authentication flow was interrupted. Please try again.',
    auth_failed: 'Sign-in failed. Google returned an error. Please try again or use email and password.',
  }
  const initialError = params.error ? (errorMessages[params.error] ?? null) : null

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <LoginForm initialError={initialError} />
    </main>
  )
}
