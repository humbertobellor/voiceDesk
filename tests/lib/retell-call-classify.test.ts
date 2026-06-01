// retell-call-classify.test.ts
// REFACTOR phase: D-09 is_active early return guard tests — cleanup pass.
// Plan 04 implements production code; these tests verify correct guard behavior.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NonRetriableError } from 'inngest'

// Mock modules before imports that use them
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))
vi.mock('@/lib/classification/emergency-keywords', () => ({
  hasHardEmergencyKeyword: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/classification/classify-intent', () => ({
  classifyIntent: vi.fn().mockResolvedValue({ intent: 'no_action', detected_trade: null }),
}))
vi.mock('@/lib/classification/extract-trade', () => ({
  extractTradeData: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/google/auth', () => ({
  getCalendarClient: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/scheduling/slots', () => ({
  computeAvailableSlots: vi.fn().mockReturnValue([]),
}))
vi.mock('@/lib/retell/system-prompt', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue(''),
  buildBeginMessage: vi.fn().mockReturnValue(''),
}))
vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, handler: unknown) => ({ _handler: handler })),
  },
}))

import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Build a minimal mock step object. step.run calls its callback directly.
 * step.sendEvent is a no-op.
 */
function makeMockStep() {
  return {
    run: vi.fn().mockImplementation((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * Build a Supabase client mock that returns the given contractor row on .maybeSingle().
 */
function makeDbMock(contractorData: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: contractorData, error })
  const eqFn = vi.fn().mockReturnValue({ maybeSingle })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const fromFn = vi.fn().mockReturnValue({ select: selectFn })
  return { from: fromFn }
}

describe('retell-call-classify — is_active early return guard (D-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore all spies (e.g., console.log spy from test 1) even if a test throws partway through.
    vi.restoreAllMocks()
  })

  it(
    'returns early with structured log when contractor.is_active=false',
    { timeout: 10000 },
    async () => {
      // Arrange: contractor exists but is deactivated
      const contractorRow = {
        id: 'c-1',
        is_active: false,
        retell_llm_id: 'r-1',
        timezone: 'UTC',
        contractor_settings: [],
      }
      const dbMock = makeDbMock(contractorRow)
      vi.mocked(createServiceRoleClient).mockReturnValue(dbMock as unknown as ReturnType<typeof createServiceRoleClient>)

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const step = makeMockStep()
      const event = { data: { callId: 'call-1', contractorId: 'c-1', transcriptText: null, durationMs: null } }

      // Import the function handler — must happen after mocks are set up.
      // We re-import each test to pick up fresh mock state via dynamic import.
      const { retellCallClassify } = await import('@/inngest/functions/retell-call-classify')

      // The Inngest createFunction mock returns an object with _handler property.
      // Extract the actual handler from the function's properties.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (retellCallClassify as any)._handler

      await handler({ event, step })

      // Assert: structured log was emitted
      const logCalls = logSpy.mock.calls
      const skippedLog = logCalls.find(args =>
        args.some(a => typeof a === 'string' && a.includes('retell-call-classify.skipped'))
      )
      expect(skippedLog).toBeDefined()

      // Assert: the logged JSON includes the correct reason
      const loggedJson = logCalls
        .flatMap(args => args)
        .find(a => typeof a === 'string' && a.includes('contractor_deactivated'))
      expect(loggedJson).toBeDefined()
      expect(JSON.parse(loggedJson as string)).toMatchObject({
        event: 'retell-call-classify.skipped',
        reason: 'contractor_deactivated',
      })

      // Assert: subsequent steps (classify-intent, create-lead, etc.) were NOT called after load-contractor
      // step.run is called exactly once (for 'load-contractor') — no additional steps
      const stepRunCalls = step.run.mock.calls.map(([name]) => name)
      expect(stepRunCalls).not.toContain('classify-intent')
      expect(stepRunCalls).not.toContain('create-lead')
      expect(stepRunCalls).not.toContain('check-hard-emergency')

      logSpy.mockRestore()
    },
  )

  it('proceeds normally when contractor.is_active=true', async () => {
    // Arrange: contractor is active
    const contractorRow = {
      id: 'c-2',
      is_active: true,
      retell_llm_id: null,
      timezone: 'UTC',
      contractor_settings: [],
    }
    const dbMock = makeDbMock(contractorRow)

    // For subsequent DB calls (persist-classification, etc.), also return safe responses
    const noopEq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const noopSelect = vi.fn().mockReturnValue({ eq: noopEq })
    const fullFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'contractors') return dbMock.from('contractors')
      return { select: noopSelect, update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: fullFrom } as unknown as ReturnType<typeof createServiceRoleClient>)

    const step = makeMockStep()
    const event = { data: { callId: 'call-2', contractorId: 'c-2', transcriptText: '', durationMs: 1000 } }

    const { retellCallClassify } = await import('@/inngest/functions/retell-call-classify')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (retellCallClassify as any)._handler

    await handler({ event, step })

    // Assert: classify-intent step WAS called (function proceeded past load-contractor)
    const stepRunCalls = step.run.mock.calls.map(([name]) => name)
    expect(stepRunCalls).toContain('check-hard-emergency')
    expect(stepRunCalls).toContain('classify-intent')
  })

  it('throws NonRetriableError when contractor is not found', async () => {
    // Arrange: DB returns null data with an error
    const dbMock = makeDbMock(null, new Error('not found'))
    vi.mocked(createServiceRoleClient).mockReturnValue(dbMock as unknown as ReturnType<typeof createServiceRoleClient>)

    const step = makeMockStep()
    const event = { data: { callId: 'call-3', contractorId: 'c-missing', transcriptText: null, durationMs: null } }

    const { retellCallClassify } = await import('@/inngest/functions/retell-call-classify')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (retellCallClassify as any)._handler

    await expect(handler({ event, step })).rejects.toThrow(NonRetriableError)
  })
})
