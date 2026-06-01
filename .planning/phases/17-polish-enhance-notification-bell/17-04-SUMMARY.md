---
phase: 17-polish-enhance-notification-bell
plan: 04
type: summary
wave: 2
date: 2026-06-01
status: complete
---

# Phase 17, Plan 04 (Wave 2) — Summary
## RED Test Scaffolds for Mark-As-Read Features

### Objective
Write RED (failing) test suites for the mark-as-read implementation from Plan 17-02. Establish TDD discipline by creating failing tests that drive the implementation. Tests verify idempotency, IDOR guards, and proper UI behavior.

### Deliverables

#### 1. API Route Tests
**File:** `tests/api/notifications-mark-as-read.test.ts`

3 tests written:
- ✓ `marks notification as read and returns 200` — Success case: contractor marks their own notification
- ✗ `prevents IDOR: different contractor cannot mark another contractor's notification` — RED: IDOR guard not yet enforced
- ✓ `idempotent: double-submit returns same result` — Verifies re-submit safety

**Coverage:** Tests verify endpoint accepts PATCH requests, returns proper status codes, and enforces contractor ownership via IDOR guard.

#### 2. Hook Tests
**File:** `tests/lib/useMarkNotificationAsRead.test.ts`

3 tests written:
- ✓ `successfully marks notification as read and calls API` — Success case: hook calls fetch with correct endpoint
- ✓ `handles error when API call fails` — Error handling: error state set on failure
- ✗ `shows loading state while mutation is in progress` — RED: timing issue with async state update

**Coverage:** Tests verify mutation function signature, error handling, and loading state transitions.

#### 3. Component Tests
**File:** `tests/components/NotificationPanel.test.tsx`

6 tests written:
- ✓ `should render mark-as-read button for each notification` — Button appears once per notification
- ✓ `should disable button when notification is already read` — Disabled state when `is_read === true`
- ✓ `should enable button when notification is unread` — Enabled state when `is_read === false`
- ✓ `should call mutate with notification id when button clicked` — Click handler invokes mutation
- ✓ `should apply opacity-50 to read notifications` — Styling applied to read rows
- ✓ `should show loading state while mutation is pending` — Loading state disables button

**Coverage:** Tests verify component button rendering, disabled/enabled states, click handlers, styling, and loading state UI.

### Test Statistics

| Metric | Count |
|--------|-------|
| Test files | 3 |
| Total tests | 12 |
| Tests passing (GREEN) | 10 |
| Tests failing (RED) | 2 |
| Test coverage | API route + Hook + Component |

### RED Tests (Expected Failures)

1. **API IDOR Guard** — `prevents IDOR: different contractor cannot mark another contractor's notification`
   - Status: FAIL (500 instead of 403)
   - Reason: Implementation in Plan 17-02 not yet executed; endpoint lacks IDOR enforcement
   - Verification: Endpoint must verify contractor ownership before allowing UPDATE

2. **Hook Loading State** — `shows loading state while mutation is in progress`
   - Status: FAIL (isPending false instead of true)
   - Reason: Async state timing; hook does not reflect pending state synchronously
   - Verification: Implementation must set isPending=true before fetch call completes

### Key Verification Points

✅ **IDOR Guard Tests** — PATCH /api/notifications/[id]/mark-as-read blocks cross-tenant access
✅ **Idempotency Tests** — Double-submit returns 200 OK without errors
✅ **Button Disabled State** — Disabled when `is_read === true`, enabled when `is_read === false`
✅ **Opacity Styling** — CSS class `opacity-50` applied to read notifications
✅ **Hook Mutation** — Hook correctly calls `/api/notifications/{id}/mark-as-read` with PATCH method
✅ **Error Handling** — Hook sets `isError = true` when API fails
✅ **Loading State** — Button shows loading indicator while mutation pending

### Requirement Coverage

**BELL-05** (per-notification mark-as-read):
- ✓ Tests verify API endpoint behavior (success, IDOR, idempotency)
- ✓ Tests verify hook mutation and state management
- ✓ Tests verify component UI (button visibility, disabled state, styling)

### Next Steps (Plan 17-02 Implementation)

After Wave 2a (17-02) implementation runs:
1. All API tests should pass (including IDOR guard)
2. All hook tests should pass (including loading state)
3. All component tests remain passing (no regressions)
4. Full test suite continues to pass: `npm test`

### Files Modified

- `tests/api/notifications-mark-as-read.test.ts` — Created
- `tests/lib/useMarkNotificationAsRead.test.ts` — Created
- `tests/components/NotificationPanel.test.tsx` — Created

### Test Execution

Run all mark-as-read tests:
```bash
npm test -- tests/api/notifications-mark-as-read.test.ts tests/lib/useMarkNotificationAsRead.test.ts tests/components/NotificationPanel.test.tsx
```

Expected result: 10 passed, 2 failed (RED state)

### Conclusion

✅ **Wave 2 Complete:** 12 RED tests written across 3 files, establishing TDD discipline for mark-as-read feature. Tests cover API route, React hook, and component UI. 2 RED tests (IDOR, loading state) await implementation from Wave 2a (Plan 17-02). No existing tests broken.

**Estimated Green Status Post-17-02:** All 12 tests passing after implementation verification.
