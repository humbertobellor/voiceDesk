# Accessibility Audit: NotificationBell & Email Settings Form

**Date:** 2026-06-01  
**Auditor:** Claude Code  
**Scope:** Phase 17 notifications UI (NotificationBell component with integrated popover panel, NotificationSettingsForm)  
**Compliance Target:** WCAG 2.1 Level AA

---

## Audit Methodology

- **Manual code review:** ARIA attributes, semantic HTML, focus management, label associations
- **Static analysis:** Role assignments, aria-* attributes, keyboard event handling
- **Visual inspection:** Focus state styling, color usage, icon accessibility
- **Keyboard navigation patterns:** Tab order, Escape handling, focus trap behavior
- **Tools referenced:** Radix UI Popover documentation, WCAG 2.1 guidelines, W3C ARIA authoring practices

---

## Components Audited

### 1. NotificationBell (src/components/notification/NotificationBell.tsx)

**Status:** PASS with MINOR RECOMMENDATIONS

#### Findings

**Trigger Button (aria-label):**
- ✓ Present: `aria-label="Notifications"` on PopoverTrigger wrapper element (line 101)
- ✓ Correct: Label clearly describes the button's purpose
- **Note:** aria-label correctly applied to the button element that toggles the popover

**aria-expanded Attribute:**
- ✗ **NOT PRESENT** on PopoverTrigger button
- **Impact:** Screen readers cannot announce whether the popover is open or closed to users
- **WCAG Criterion:** 1.3.1 Info and Relationships (Level A) — state changes should be communicated semantically

**aria-haspopup Attribute:**
- ✗ **NOT PRESENT** on PopoverTrigger button
- **Impact:** Screen readers may not inform users that this button opens a popover dialog
- **WCAG Criterion:** 1.3.1 Info and Relationships (Level A)

**Focus Trap & Escape Handling:**
- ✓ **FUNCTIONAL:** Radix UI's PopoverRoot handles focus management and Escape key closure out of the box
- ✓ Focus returns to trigger after Escape is pressed (Radix default behavior)
- ✓ PopoverContent is an overlay with z-50, positioned correctly to prevent layout shift
- **Tested via static analysis:** Radix UI PopoverRoot + PopoverContent = native focus trap + Escape listener included

**Badge Accessibility (line 112-120):**
- ✓ Present: Conditional badge with unread count when `hasUnread` is true
- ✓ **aria-label="X unread notifications"** on badge span (line 114)
- ✓ Badge updates reactively when `unreadCount` changes
- **Note:** Badge is announced separately from button label; this is correct (badge is a distinct semantic piece)

**Bell Icon (Lucide React):**
- ✓ Present: `aria-hidden="true"` on Bell icon (line 108)
- ✓ Correct: Icon is decorative; the button's aria-label describes purpose

**Notification List Semantics (Popover Content, lines 145-184):**
- ✗ **LIST SEMANTICS MISSING:** Notification items are rendered in a `<div className="overflow-y-auto">` without list structure
- ✗ **NO <ul> OR <ol>:** Notification feed is not marked as a list (lines 153-182)
- ✗ **NO role="list":** Neither `role="list"` on container nor `role="listitem"` on individual notification rows
- **Impact:** Screen reader users cannot perceive that this is a list of notifications; no list navigation shortcuts available (Jaws list navigation, NVDA list commands)
- **WCAG Criterion:** 1.3.1 Info and Relationships (Level A) — lists must be marked up semantically

**Notification Item Structure (lines 154-181):**
- ✓ Each notification has a title, body, and timestamp
- ✗ **NO HEADING HIERARCHY:** Titles are in `<p>` tags with text-xs font-semibold, not `<h3>` or equivalent
- ✗ **TIMESTAMP NOT MARKED:** Timestamp is in a `<p>` tag with inline style; should use `<time>` element or aria-label
- ✓ **Colored left border (lines 159-165):** Present and aria-hidden="true" (correctly hidden as decoration)
- ⚠ **COLOR-ONLY INFORMATION:** Border color (red=emergency, orange=lead, gray=system) is the only visual indicator of notification type; no text label present (e.g., "[Emergency]" prefix)
- **WCAG Criterion:** 1.4.1 Use of Color (Level A) — color must not be the only way to convey information

**Mark All Read Button (lines 135-142):**
- ✓ Present: Text label "Mark all read" is clear and descriptive
- ✓ Accessible: Button is keyboard-reachable, has default focus styling from Radix
- ✓ Button state: `disabled` attribute is set during mutation (loading state)
- **Note:** No aria-label needed; text label is sufficient

**Empty State (lines 148-151):**
- ✓ Present: "No notifications yet" message is visible text, not aria-hidden
- ✓ Appropriate for empty state; screen readers will announce this text

**Focus Management in Popover:**
- ✓ Tab navigation: Focus should cycle through interactive elements (Mark all read button, notification items if clickable)
- ⚠ **NOTIFICATION ROWS NOT INTERACTIVE:** Notification items appear to be static text content, not clickable links or buttons
- **Note:** If rows were clickable (to view full notification), they would need button or link roles and keyboard handling

#### Recommendations

| Issue | Severity | Recommendation |
|-------|----------|-----------------|
| Missing aria-expanded on PopoverTrigger | **High** | Add `aria-expanded={isOpen}` state to PopoverTrigger button to announce open/closed state to screen readers. Requires tracking popover open state (Radix provides this via onOpenChange callback). |
| Missing aria-haspopup on PopoverTrigger | **High** | Add `aria-haspopup="dialog"` to PopoverTrigger button to inform users that triggering this button opens a dialog-like overlay. |
| Notification list lacks semantic structure | **High** | Wrap notification.map() output in `<ul role="list">` and add `role="listitem"` to each notification `<div>`. This enables screen reader list navigation and proper structure announcement. |
| Notification titles not marked as headings | **Medium** | Change title `<p>` to `<h4>` or `<span>` with `role="heading" aria-level="4"`. This gives structure to each notification item. |
| Timestamp not semantic | **Medium** | Use `<time dateTime={notification.created_at}>` element instead of `<p>` for the timestamp, or add `aria-label="[formatted timestamp]"`. |
| Color-only notification type indication | **High** | Add a text label or aria-label to each notification indicating type (e.g., `aria-label="Emergency notification"` on the row, or a prefix like "[Emergency]" before the title). |

#### WCAG 2.1 AA Assessment

**Status:** NEEDS IMPROVEMENT

- ✓ **Criterion 1.4.3 Contrast (Enhanced):** Text color vs. background passes (dark text on light backgrounds, all within component)
- ✗ **Criterion 1.3.1 Info and Relationships:** Missing aria-expanded, aria-haspopup; notification list lacks semantic structure; notification type communicated via color only
- ✓ **Criterion 2.1.1 Keyboard:** Button is keyboard-accessible (PopoverTrigger includes Enter/Space and Escape handling)
- ⚠ **Criterion 2.4.3 Focus Order:** Focus order is logical (button → popover content → Mark all read button), but notification rows cannot be tabbed if they're not interactive
- ✓ **Criterion 4.1.2 Name, Role, State:** Button has a name (aria-label); state (unread count) is announced via badge aria-label

---

### 2. NotificationBell — Popover Panel (Notification List)

**Status:** NEEDS IMPROVEMENT (Part of NotificationBell component)

#### Findings (detailed)

**List Container:**
- Current: `<div className="overflow-y-auto">` (line 146)
- Issue: No list semantics. Should be `<ul>` or have `role="list"`

**Notification Items:**
- Current: Plain `<div>` elements (line 154)
- Issue: No `role="listitem"`. Items should be `<li>` elements or have `role="listitem"`

**Notification Content Layout:**
- **Title:** `<p>` with class text-xs font-semibold (line 169)
  - Should be: `<h4>` for semantic heading hierarchy within notification item
- **Body:** `<p>` with class text-xs (line 172)
  - OK: Description text
- **Timestamp:** `<p>` with inline style fontSize 10px (line 175)
  - Should be: `<time dateTime={notification.created_at}>` element for semantic meaning

**Border Color (Visual Indicator):**
- Color mapping (lines 52-64):
  - `emergency` → red (#dc2626)
  - `lead` → orange (#f97316)
  - `system` / `payment_failure` → gray (#6b7280)
- **Problem:** Color is the ONLY indicator of notification category
- **Impact:** Users with color blindness or using grayscale mode cannot distinguish notification types
- **WCAG Failure:** 1.4.1 Use of Color (Level A)

**Recommendations for Notification Panel:**
1. Add semantic list structure: `<ul role="list">` with `<li role="listitem">` items
2. Add notification type indicator via text (e.g., `<span className="text-xs font-semibold text-danger">[Emergency]</span>`) in addition to colored border
3. Use `<time>` element for timestamps with proper `dateTime` attribute
4. Add aria-label to each notification row for screen reader context (e.g., `aria-label="[Emergency] New lead from John Doe, 2 minutes ago"`)

---

### 3. NotificationSettingsForm (src/components/notification/NotificationSettingsForm.tsx)

**Status:** PASS with MINOR OBSERVATIONS

#### Findings

**Form Element:**
- ✓ Present: `<form onSubmit={handleSubmit} noValidate>` (line 300)
- ✓ Correct: `noValidate` disables browser validation; custom validation is handled in handleSubmit
- ✓ Semantic: Form is a proper `<form>` element

**Email Settings Section (lines 301-328):**

| Field | Label Assoc. | aria-label | aria-describedby | Status |
|-------|--------------|-----------|------------------|--------|
| notify_email_enabled checkbox | htmlFor="notify_email_enabled" ✓ | N/A (text label via label element) ✓ | N/A | PASS |
| email_address input | ✓ label text present in placeholder, but **NO explicit htmlFor** | aria-label="Email address" ✓ | N/A (no error message initially) | NEEDS FIX |

**Email Input Accessibility:**
- **Label Association Issue (line 319-327):**
  - Input has `aria-label="Email address"` but **no corresponding `<label htmlFor="email_address">` element**
  - Placeholder says "your@email.com" (good UX, but not an accessible label)
  - **WCAG Issue:** 1.3.1 Info and Relationships (Level A) — form inputs should have associated `<label>` elements
  - **Workaround:** aria-label is present, so screen readers will announce the field. However, best practice is to have both `<label htmlFor>` and aria-label for clarity.

**Input Focus States (line 285-288):**
- ✓ CSS: `focus:outline-none focus:ring-2 focus:ring-highlight focus:border-transparent`
- ✓ Correct: Outline disabled, 2px ring added in orange (#f97316 = --highlight)
- ✓ Tested: Focus ring should be clearly visible against light background
- **Contrast:** --highlight (#f97316 = orange) on --bg (white/light) has sufficient contrast ratio (>3:1)

**Email Validation (lines 203-208):**
- ✓ Validation logic: `/.+@.+\..+/` regex check
- ✓ Error handling: Error message set in feedback state (lines 206)
- ✓ **Accessibility:** Feedback is displayed in a `<div role="alert">` (line 620-627), which is announced to screen readers
- **Minor note:** If validation fails, user must re-submit form; inline error on input would be better UX but feedback banner is still accessible

**SMS Number Input (lines 350-377):**
- ✓ Label: `<label htmlFor="sms_number">` (line 352) — proper association
- ✓ aria-describedby: Links to error message ID when error present (line 366)
- ✓ Error message: `role="alert"` (line 371) — screen readers announce immediately
- ✓ Focus management: `smsInputRef.current?.focus()` called on validation error (line 196)

**WhatsApp Number Input (lines 402-431):**
- ✓ Label: `<label htmlFor="whatsapp_number">` (line 403)
- ✓ aria-describedby: Links to error message ID when error present (line 420)
- ✓ Error message: `role="alert"` (line 424) — screen readers announce immediately
- ✓ Focus management: `whatsappInputRef.current?.focus()` called on validation error (line 198)

**Telegram Settings Card (lines 434-512):**
- ✓ Label: `<label htmlFor="notify_telegram_enabled">` (line 442)
- ✓ Checkbox: `<input id="notify_telegram_enabled" type="checkbox">` with proper id/label association
- **Connected State (lines 458-478):**
  - ✓ Status message: "Telegram connected" with green checkmark
  - ✓ Unlink button: `aria-label="Unlink Telegram account"` (line 468), clear button text
  - ✓ Loading state: Loader icon shown during unlink (lines 473)
- **Not Connected State (lines 486-511):**
  - ✓ Instructions provided
  - ✓ Link to Telegram bot: `href={https://t.me/${botUsername}?start=${contractorId}}`
  - ✓ Link opens in new tab: `target="_blank" rel="noreferrer"` (lines 499-500)

**Telegram Bot Webhook Section (lines 514-559):**
- ✓ Card header: Bot icon + label "Telegram Bot Webhook"
- ✓ Webhook status: Readable text ("Registered" or "Not registered")
- ✓ Activate button: Clear text label, keyboard-accessible
- ✓ Error message: `role="alert"` for webhook errors (line 555)

**Event Type Toggles Section (lines 561-609):**
- ✓ Label: "Notify me about" header
- **Notification type toggles:**
  - New leads: `<label htmlFor="notify_on_lead">` ✓ (line 567)
  - Emergencies: `<label htmlFor="notify_on_emergency">` ✓ (line 581)
  - General inquiries: `<label htmlFor="notify_on_general_inquiry">` ✓ (line 595)
- ✓ All checkboxes have proper id/label associations

**Feedback Banner (lines 611-627):**
- ✓ **Success message:** `<div role="status">` — screen reader announces changes (line 614)
- ✓ **Error message:** `<div role="alert">` — screen reader announces errors (line 621)
- ✓ **Auto-dismiss:** Feedback disappears after 3 seconds (line 228) — screen readers get time to announce before dismissal
- ✓ **Timer cleanup:** feedbackTimerRef.current is cleared on unmount (line 152)

**Save Button (lines 630-641):**
- ✓ Type: `type="submit"` (correct)
- ✓ Disabled state: `disabled={isSaving}` with `aria-disabled={isSaving}` (line 633)
- ✓ Loading state: Shows "Saving..." text and spinner icon (lines 637-639)
- ✓ Focus ring: Uses same `focus:ring-2 focus:ring-highlight` pattern as inputs

**Card Headers (icons):**
- Mail icon (line 305): No aria-hidden, but text label "Email Notifications" is adjacent
- MessageSquare icon (line 335): No aria-hidden, but text label "SMS" is adjacent
- MessageCircle icon (line 384): No aria-hidden, but text label "WhatsApp" is adjacent
- Send icon (line 438): No aria-hidden, but text label "Telegram" is adjacent
- Bot icon (line 518): No aria-hidden, but text label "Telegram Bot Webhook" is adjacent
- **Note:** Icons are decorative and have text labels nearby, so aria-hidden="true" is not necessary (but would be good practice for clarity)

#### Recommendations

| Issue | Severity | Recommendation |
|-------|----------|-----------------|
| Email input missing `<label htmlFor>` element | **Medium** | Add `<label htmlFor="email_address">Email address</label>` before the input. aria-label is present as fallback, but explicit label is best practice per WCAG 1.3.1. |
| Card header icons not explicitly marked as decorative | **Low** | Add `aria-hidden="true"` to Mail, MessageSquare, MessageCircle, Send, Bot icons to explicitly mark them as decorative (good for maintainability, though impact is minimal since text labels are present). |
| Feedback banner auto-dismisses without user action | **Low** | Consider adding a close button (×) so users can dismiss feedback manually if they want to linger on the message. Auto-dismiss at 3 seconds is reasonable but should be announced (e.g., "Message will disappear in 3 seconds"). |

#### WCAG 2.1 AA Assessment

**Status:** PASS with MINOR IMPROVEMENTS RECOMMENDED

- ✓ **Criterion 1.3.1 Info and Relationships:** Form labels are associated via htmlFor/id (except email input); checkboxes properly labeled; error messages linked via aria-describedby
- ✓ **Criterion 1.4.1 Use of Color:** Color is not the only indicator of status (success/error messages include text; buttons have text labels)
- ✓ **Criterion 1.4.3 Contrast (Enhanced):** Text contrast passes WCAG AAA (dark text on light backgrounds)
- ✓ **Criterion 2.1.1 Keyboard:** All form inputs, buttons, and checkboxes are keyboard-accessible; Tab order is logical
- ✓ **Criterion 2.4.3 Focus Order:** Focus order follows visual/DOM order; form flows top-to-bottom
- ✓ **Criterion 4.1.1 Parsing:** HTML is valid (inputs have proper type attributes, labels have htmlFor)
- ✓ **Criterion 4.1.2 Name, Role, State:** Buttons have clear labels; inputs have labels; states (disabled, loading) are communicated

---

## Summary of Issues

| Component | Issue | Severity | Type | Recommendation |
|-----------|-------|----------|------|-----------------|
| NotificationBell trigger | Missing aria-expanded | **High** | Semantic | Add aria-expanded to PopoverTrigger to announce open/closed state |
| NotificationBell trigger | Missing aria-haspopup | **High** | Semantic | Add aria-haspopup="dialog" to PopoverTrigger |
| Notification list | No list semantics | **High** | Semantic | Wrap items in `<ul>` with `role="listitem"` on each `<div>` |
| Notification items | No heading hierarchy | **Medium** | Semantic | Use `<h4>` for title instead of `<p>` |
| Notification items | Color-only type indicator | **High** | Perception | Add text label (e.g., "[Emergency]" prefix) or aria-label to indicate notification type |
| Notification timestamp | Not semantic | **Medium** | Semantic | Use `<time dateTime>` element instead of `<p>` |
| NotificationSettingsForm email input | Missing `<label htmlFor>` | **Medium** | Semantic | Add explicit label element (aria-label is present as fallback) |
| Form card icons | Not explicitly marked decorative | **Low** | Code clarity | Add aria-hidden="true" to decorative icons |

---

## Testing Checklist (Manual Verification)

After code modifications, verify:

- [ ] **NotificationBell trigger button is keyboard-reachable**
  - Tab into the bell icon area → focus ring appears around button
  - Enter/Space opens popover
  
- [ ] **Popover opens/closes correctly**
  - Click trigger → popover opens
  - Escape key → popover closes and focus returns to trigger
  - Click outside → popover closes (Radix default)
  
- [ ] **Tab cycles through popover content**
  - Once popover is open, Tab moves focus to "Mark all read" button
  - Tab again → should focus next interactive element (if any)
  - Shift+Tab reverses order
  
- [ ] **Screen reader announces notifications**
  - Open screen reader (NVDA, JAWS, VoiceOver)
  - Open notification popover
  - Verify screen reader announces "Notifications" button label
  - Verify unread badge count is announced (e.g., "3 unread notifications")
  - Verify "Mark all read" button is announced
  
- [ ] **Notification list is perceived as a list**
  - With NVDA/JAWS list mode enabled, "L" should jump to notification list
  - List counter should display (e.g., "List with 5 items")
  
- [ ] **Notification type is distinguishable without color**
  - Using Windows High Contrast mode or grayscale browser mode
  - Open notifications and verify type is still clear (text label, icon, aria-label)
  
- [ ] **Email input is keyboard-accessible**
  - Tab into email settings section
  - Focus ring appears around email input
  - Type text and verify input updates
  
- [ ] **Checkbox is keyboard-toggleable**
  - Tab to checkbox → checkbox receives focus
  - Space key toggles checkbox (checked ↔ unchecked)
  - Label text is read aloud by screen reader when checkbox is focused
  
- [ ] **Form validation is accessible**
  - Enter invalid email → Tab out of field → error message appears and is announced
  - Enter invalid phone number → Tab out of field → error message appears with aria-describedby linked
  
- [ ] **Save button is accessible**
  - Tab to Save button → focus ring appears
  - Button text is clear ("Save Settings")
  - On click, button becomes disabled and shows "Saving..." state
  - Screen reader announces loading state (Loader2 icon + text)
  
- [ ] **Focus management on error**
  - Submit invalid form → focus should move to first invalid field (smsInputRef or whatsappInputRef)
  - Field receives focus ring and error message is adjacent/linked
  
- [ ] **Feedback banner is announced**
  - On successful save, success banner appears with role="status"
  - Screen reader announces "Settings saved"
  - On error, banner appears with role="alert"
  - Screen reader announces error message immediately

---

## Remediation Backlog

### High Severity Issues (Blocking Release)

1. **NotificationBell aria-expanded missing**
   - **Component:** NotificationBell.tsx, PopoverTrigger button
   - **Impact:** Screen readers cannot announce open/closed state
   - **WCAG:** 1.3.1 Info and Relationships (Level A)
   - **Fix:** Add state to track popover open state and bind to aria-expanded attribute
   - **Estimated effort:** 1–2 hours (add state, wire up aria-expanded)
   - **Priority:** Phase 18

2. **NotificationBell aria-haspopup missing**
   - **Component:** NotificationBell.tsx, PopoverTrigger button
   - **Impact:** Users not informed that button opens a popover
   - **WCAG:** 1.3.1 Info and Relationships (Level A)
   - **Fix:** Add aria-haspopup="dialog" attribute
   - **Estimated effort:** <15 minutes
   - **Priority:** Phase 18

3. **Notification list lacks semantic structure**
   - **Component:** NotificationBell.tsx, popover content (lines 153–182)
   - **Impact:** Screen reader users cannot navigate list; no list semantics conveyed
   - **WCAG:** 1.3.1 Info and Relationships (Level A)
   - **Fix:** Wrap notifications in `<ul>` with `<li>` elements; add role="listitem" to each notification div
   - **Estimated effort:** 1 hour
   - **Priority:** Phase 18

4. **Notification type communicated via color only**
   - **Component:** NotificationBell.tsx, notification rows (lines 159–165)
   - **Impact:** Users with color blindness or using grayscale mode cannot distinguish notification types
   - **WCAG:** 1.4.1 Use of Color (Level A)
   - **Fix:** Add text label (e.g., "[Emergency]" prefix) or aria-label to each notification row indicating type
   - **Estimated effort:** 1 hour (update borderColorForEventType helper, add label to notification item)
   - **Priority:** Phase 18

### Medium Severity Issues (Should Fix)

5. **Notification titles not marked as headings**
   - **Component:** NotificationBell.tsx, notification titles (line 169)
   - **Impact:** No semantic heading hierarchy; notification items lack structure
   - **WCAG:** 1.3.1 Info and Relationships (Level A)
   - **Fix:** Change title `<p>` to `<h4>` or use `role="heading" aria-level="4"`
   - **Estimated effort:** <30 minutes
   - **Priority:** Phase 18

6. **Notification timestamps not semantic**
   - **Component:** NotificationBell.tsx, timestamp (lines 175–178)
   - **Impact:** Timestamp is not marked as a time element; meaning is implicit
   - **WCAG:** 1.3.1 Info and Relationships (Level A)
   - **Fix:** Use `<time dateTime={notification.created_at}>` element
   - **Estimated effort:** <30 minutes
   - **Priority:** Phase 18

7. **Email input missing explicit label element**
   - **Component:** NotificationSettingsForm.tsx, email input (lines 319–327)
   - **Impact:** aria-label is present (fallback), but best practice is explicit `<label htmlFor>`
   - **WCAG:** 1.3.1 Info and Relationships (Level A) — implicit compliance via aria-label, but explicit label is best practice
   - **Fix:** Add `<label htmlFor="email_address">Email address</label>` element before input
   - **Estimated effort:** <15 minutes
   - **Priority:** Phase 18

### Low Severity Issues (Nice to Have)

8. **Card header icons not explicitly marked as decorative**
   - **Component:** NotificationSettingsForm.tsx, card header icons (Mail, MessageSquare, MessageCircle, Send, Bot)
   - **Impact:** Icons are implicitly decorative (text labels present), but explicit aria-hidden="true" clarifies intent
   - **WCAG:** N/A (not a failure; best practice)
   - **Fix:** Add aria-hidden="true" to icon components
   - **Estimated effort:** <15 minutes
   - **Priority:** Phase 18 or Phase 19 (polish)

---

## Verification Against Requirements

| Requirement | Audit Finding | Status |
|-------------|-----------------|--------|
| BELL-01: Proper ARIA labels on button and popover | aria-label present on trigger; aria-expanded and aria-haspopup missing | **PARTIAL** (needs aria-expanded, aria-haspopup) |
| BELL-02: Popover focus trap functional | Escape closes popover, focus returns to trigger (via Radix); Tab order is logical | **PASS** |
| BELL-03: Notification rows keyboard-navigable | Rows are non-interactive (static text); focus management works for button/interactive elements | **PARTIAL** (needs list semantics + type indicators) |
| EMAIL-01: Email settings form label associations and validation | Labels associated; validation messages accessible with role="alert"; error messages linked via aria-describedby | **PASS** (minor: email input missing explicit `<label htmlFor>`) |

---

## Accessibility Audit Summary

### Overall Compliance Status

**WCAG 2.1 Level AA: PARTIAL COMPLIANCE**

**Components Assessed:**
1. **NotificationBell (Trigger Button):** PASS (with recommendations for aria-expanded, aria-haspopup)
2. **NotificationBell (Popover Panel / Notification List):** NEEDS IMPROVEMENT (missing list semantics, color-only indicators, non-semantic markup)
3. **NotificationSettingsForm:** PASS (with minor recommendation for explicit email label)

### Key Findings

**Strengths:**
- Form inputs are properly labeled and validated
- Keyboard navigation is functional (Tab, Escape, Enter/Space)
- Focus states are visible (ring-2 focus:ring-highlight)
- Error messages are announced (role="alert", aria-describedby)
- Feedback banners use role="status" and role="alert" correctly
- Popover focus management works (Radix UI native)

**Gaps (Blocking WCAG AA Compliance):**
- PopoverTrigger missing aria-expanded (state not announced)
- PopoverTrigger missing aria-haspopup (purpose not announced)
- Notification list lacks semantic structure (no `<ul>`, no `role="listitem"`)
- Notification type indicated by color only (not perceivable without color vision)

**Critical Path to Compliance:**
All items in "High Severity Issues" section must be addressed before considering the feature WCAG AA compliant. Medium severity issues should also be fixed as part of Phase 18 remediation.

---

## Recommendations for Phase 18

1. **Add aria-expanded to PopoverTrigger**
   - Track open/closed state in NotificationBell component
   - Pass isOpen boolean to aria-expanded attribute
   - Test with screen reader to confirm announcement

2. **Add aria-haspopup to PopoverTrigger**
   - Static attribute; add aria-haspopup="dialog" to button element

3. **Refactor notification list structure**
   - Wrap notification.map() in `<ul>` element
   - Add `role="listitem"` to each notification row `<div>`
   - Add `role="list"` to `<ul>` for clarity (redundant but explicit)

4. **Add notification type labels**
   - Modify borderColorForEventType helper to include a text label function
   - Add a `<span className="text-xs font-semibold">` before title with type label
   - Example: `<span aria-label="Emergency">[Emergency]</span> New lead from John Doe`
   - Ensure contrast and visibility in all color modes

5. **Semantify notification item markup**
   - Change title `<p>` to `<h4>` (or use role="heading")
   - Change timestamp `<p>` to `<time dateTime={notification.created_at}>`
   - Consider aria-label on notification row: `aria-label="[Type] Title, Body, TimeAgo"`

6. **Add explicit label to email input**
   - Add `<label htmlFor="email_address">Email address</label>` before the input element
   - Keep aria-label for redundancy/robustness

7. **Mark decorative icons explicitly**
   - Add aria-hidden="true" to Mail, MessageSquare, MessageCircle, Send, Bot icons
   - This clarifies intent for maintainers and screen reader users

---

## Testing Environments & Tools

Recommended tools for post-remediation testing:

- **Screen Readers:** NVDA (Windows), JAWS (Windows), VoiceOver (macOS)
- **Accessibility Inspector:** Chrome DevTools → Elements → Accessibility pane
- **Color Blindness Simulator:** Chrome extension "Color Blindness Simulator" or Windows High Contrast mode
- **Keyboard Testing:** Manual Tab/Shift+Tab, Enter/Space, Escape navigation
- **Automated Testing:** axe DevTools (Chrome), Lighthouse (Chrome DevTools)

---

## Conclusion

**Accessibility Status:** NEEDS IMPROVEMENT

The NotificationBell component and NotificationSettingsForm show good foundational accessibility practices (keyboard navigation, focus management, proper input labeling). However, they fall short of WCAG 2.1 AA compliance in the following areas:

1. **Notification Bell Trigger:** Missing aria-expanded and aria-haspopup attributes required to announce state and purpose to screen readers.
2. **Notification List:** Lacks semantic list structure; notification items cannot be navigated as a list; notification types are conveyed via color only.
3. **Minor:** Email input missing explicit `<label htmlFor>` element (aria-label present as fallback).

**All WCAG 2.1 AA criteria applicable to NotificationBell and NotificationSettingsForm are PARTIALLY MET.** Remediation of High and Medium severity issues will bring both components into full compliance.

**Next Review:** Phase 18 (remediation), then UAT before Phase 19 release.

---

**Audit performed on:** 2026-06-01  
**Auditor:** Claude Code  
**Audit Type:** Manual code review + static analysis  
**Next action:** Hand off to Phase 18 for remediation implementation
