// src/lib/validations/onboarding.ts
// Source: RESEARCH.md Code Examples (phone capture form, language form).
import { z } from 'zod'

// Signup form (D-01 secondary path: email/password)
export const signupSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
export type SignupFormData = z.infer<typeof signupSchema>

// Phone capture step (D-02 — required gate before dashboard)
// US numbers only in this release (UI-SPEC.md Surface 2). E.164 format: +1XXXXXXXXXX.
// libphonenumber-js refinement will be added in Plan 04 if the regex proves insufficient.
export const phoneSchema = z.object({
  phone_number: z
    .string()
    .regex(/^\+1\d{10}$/, 'Enter a valid US phone number, e.g. +13055551234.'),
  business_name: z.string().min(1, 'Business name is required.'),
  area_code: z.string().regex(/^\d{3}$/, 'Enter a 3-digit US area code.'),
})
export type PhoneFormData = z.infer<typeof phoneSchema>

// LANG-02: language selection in agent config settings
// Supported languages: en (English), es (Spanish), ht (Haitian Creole)
export const languageSchema = z.object({
  supported_languages: z
    .array(z.enum(['en', 'es', 'ht']))
    .min(1, 'At least one language must be selected.'),
})
export type LanguageFormData = z.infer<typeof languageSchema>
