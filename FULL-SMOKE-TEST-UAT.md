---
session: 2026-05-31
phase: all-v1.1-smoke-test
status: blocked-on-stripe-checkout
---

# Full Koolable Smoke Test (v1.1 End-to-End)

## Test Results Summary

| Test # | Area | Status | Notes |
|--------|------|--------|-------|
| 1 | Auth Page Load | ✅ PASS | Login page renders with design system |
| 2 | Signup Flow | ✅ PASS | Account created successfully, password validation working |
| 3 | Post-Signup Routing | ✅ PASS | Routed to setup/phone after signup |
| 4 | Phone Setup Form | ✅ PASS | Form validation working (mobile number length check) |
| 5 | Pricing Page Display | ✅ PASS | Three-tier pricing displayed with design system |
| 6 | Stripe Checkout API | ❌ FAIL | `/api/stripe/checkout` returns 500 error |

---

## Detailed Findings

### ✅ Test 1: Auth Page Load
- **URL:** `http://localhost:3001/auth/login`
- **Result:** Page loads successfully
- **Observations:**
  - Design system colors and typography applied correctly
  - Google OAuth button present
  - Email/password form present
  - Sign up link functional
  - Layout is clean and on-brand

### ✅ Test 2: Signup Flow
- **Email:** `testcontractor@voicedesk.test`
- **Result:** Account created successfully
- **Observations:**
  - Password validation requirements displayed (8+ chars, uppercase, number)
  - Form accepted valid password: `TestPassword123!`
  - Confirm password field present and working
  - No validation errors on submit

### ✅ Test 3: Post-Signup Routing
- **Expected Route:** `/dashboard` or similar
- **Actual Route:** `/setup/phone`
- **Result:** Correct routing behavior
- **Observations:**
  - Post-signup flow directs to phone setup (onboarding workflow)
  - No unexpected redirects

### ✅ Test 4: Phone Setup Form
- **Fields Tested:**
  - Business name: `"Test HVAC Co"` ✅
  - Mobile number: `"+1 (305) 555-0100"` ✅ (initial attempt rejected as too short, fixed on second attempt)
  - Area code: `"305"` ✅
- **Result:** Form validation working as intended
- **Observations:**
  - Phone number validation enforces minimum length
  - Form submitted successfully to `/pricing`
  - Clear error messaging

### ✅ Test 5: Pricing Page Display
- **URL:** `/pricing`
- **Tiers Displayed:**
  1. Basic: $299/month (10 calls limit)
  2. Professional: $499/month (Unlimited calls) — marked MOST POPULAR
  3. Enterprise: $799/month (White label + custom integrations)
- **Result:** Page renders with correct design system styling
- **Observations:**
  - All three plans visible
  - Feature lists populated correctly
  - "Start free trial" buttons present on all tiers
  - Copy mentions 14-day free trial, no credit card required

### ❌ Test 6: Stripe Checkout API — **CRITICAL FAILURE**

**Issue:** `/api/stripe/checkout` endpoint returns HTTP 500 error

**Error Message (Browser Console):**
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3001/api/stripe/checkout
```

**UI Feedback:**
- User-facing error banner: "Failed to create checkout session"
- Button click triggers the error (Professional plan, "Start free trial" button)

**Impact:**
- **Severity:** BLOCKING — plan selection / payment flow completely non-functional
- **Scope:** Prevents progress through onboarding wizard
- **User Path:** Signup → Phone Setup → Pricing → **BLOCKED HERE**

**Investigation Steps Completed:**
1. ✅ Checked browser console — confirmed 500 from `/api/stripe/checkout`
2. ✅ Checked Next.js dev logs (`.next/dev/logs/next-development.log`) — no server-side error details logged
3. ⚠️ Realtime subscription logs show repeated `CLOSED` status (potential secondary issue, not blocking current test)

**Next Steps for Diagnosis:**
1. Check `.env.local` to verify `STRIPE_SECRET_KEY` is set and valid
2. Check `/src/app/api/stripe/checkout/route.ts` for implementation
3. Review Stripe API response handling in the route handler
4. Check if `STRIPE_PUBLISHABLE_KEY` is correctly wired on the client side

---

## Test Run Environment

- **Date:** 2026-05-31
- **Time:** ~03:09 UTC
- **Dev Server:** Next.js 16.2.4 on `http://localhost:3001`
- **Browser:** Playwright (Chromium)
- **Test Account:** `testcontractor@voicedesk.test`

---

## Test Status Summary

**Overall:** ❌ **BLOCKED**

- **Tests Passed:** 5/6 (83%)
- **Tests Failed:** 1/6 (17%)
- **Blocking Issues:** 1 (Stripe checkout 500 error)

**Next Test:** Cannot proceed to dashboard / agent config / call simulation without fixing Stripe checkout.

---

## Recommended Fix Priority

1. **CRITICAL (Blocking UAT):** Fix `/api/stripe/checkout` 500 error
   - Verify Stripe API key environment variables
   - Check route handler for unhandled exceptions
   - Review request/response shape

2. **Secondary (Monitor):** Investigate Realtime subscription closures
   - Check if leads/calls Realtime subscriptions are being created/destroyed rapidly
   - Potential memory leak or rapid connect/disconnect cycle

---

## Observations on Design System

All rendered pages (login, signup, pricing) display correct Wolknitive brand tokens:
- ✅ Orange primary buttons (#C87137)
- ✅ Light background color (off-white)
- ✅ Proper typography hierarchy
- ✅ Correct spacing and layout

No hardcoded hex values observed in rendered output — design system sweep appears successful from visual inspection.
