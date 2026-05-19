// src/lib/validations/onboarding.ts
// Source: RESEARCH.md Code Examples (phone capture form, language form).
import { z } from 'zod'

// Signup form (D-01 secondary path: email/password)
export const signupSchema = z.object({
  email: z.string()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
  password: z.string()
    .min(1, 'Password is required.')
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
export type SignupFormData = z.infer<typeof signupSchema>

// Phone capture step (D-02 — required gate before dashboard)
// US numbers only in this release. Accepts multiple formats:
// - +13055551234 (E.164)
// - 3055551234 (10 digits)
// - (305) 555-1234 (with formatting)
// Normalizes to E.164 for storage.
export const phoneSchema = z.object({
  phone_number: z
    .string()
    .min(10, 'Phone number is too short.')
    .refine((val) => {
      // Remove all formatting characters, keep only digits and leading +
      const digits = val.replace(/[\s\-\(\)\.]/g, '').replace(/^\+?1?/, '')
      return digits.length === 10 && /^\d{10}$/.test(digits)
    }, 'Enter a valid 10-digit US phone number (e.g., 3055551234 or +1 305 555 1234).'),
  business_name: z.string().min(1, 'Business name is required.'),
  area_code: z.string().regex(/^\d{3}$/, 'Enter a 3-digit US area code (e.g., 305).'),
})
export type PhoneFormData = z.infer<typeof phoneSchema>

// LANG-02: language selection in agent config settings
// D-01 Phase 2: HC removed. Supported languages: en (English), es (Spanish) only.
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es']))
    .min(1, 'At least one language must be selected.'),
})
export type LanguageFormData = z.infer<typeof languageSchema>
