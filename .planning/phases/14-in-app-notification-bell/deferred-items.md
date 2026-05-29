# Deferred Items — Phase 14

## Pre-existing test failures (out of scope for Plan 14-02)

8 tests in `tests/notifications/notify-dispatch.test.ts` under
`describe('computeChannels — channel dispatch matrix')` fail because they assert
`computeChannels` returns only 3 keys `{ shouldSendSms, shouldSendWhatsApp, shouldSendTelegram }`
but `computeChannels` now returns 4 keys including `shouldSendEmail` (added in a prior phase).

These failures pre-date Phase 14 and are unrelated to Plan 14-02 changes.

**Failing tests:**
- `no_action intent → all channels skipped`
- `null intent → all channels skipped`
- `lead intent with all channels configured → all channels fire`
- `lead intent with notify_on_lead=false → all channels suppressed`
- `emergency intent with notify_on_emergency=false → all channels suppressed`
- `info intent without notify_on_general_inquiry → all channels skipped`
- `info intent with notify_on_general_inquiry=true → all channels fire`
- `null settings → all channels skipped`

**Fix:** Update the `expect(result).toEqual(...)` assertions to include
`shouldSendEmail: false` (or the correct value) in the expected object shape.
These tests need to be updated by a future plan or maintenance task.
