// tests/db/rls.test.ts
// Covers D-18: no cross-tenant data access on any of the 9 tables.
// Requires: scripts/seed-rls-test-fixtures.ts has been run + .env.test populated.
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const userAJwt = process.env.TEST_USER_A_JWT
const userBJwt = process.env.TEST_USER_B_JWT
const contractorAId = process.env.TEST_CONTRACTOR_A_ID
const contractorBId = process.env.TEST_CONTRACTOR_B_ID

if (!url || !anonKey || !userAJwt || !userBJwt || !contractorAId || !contractorBId) {
  throw new Error(
    'tests/db/rls.test.ts requires TEST_USER_A_JWT, TEST_USER_B_JWT, TEST_CONTRACTOR_A_ID, TEST_CONTRACTOR_B_ID. ' +
    'Run: npx tsx scripts/seed-rls-test-fixtures.ts'
  )
}

function authedClient(jwt: string) {
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const clientA = authedClient(userAJwt)
const clientB = authedClient(userBJwt)

describe('RLS isolation across all 9 tables (D-18)', () => {
  // ===================== contractors (Pattern A) =====================
  describe('contractors', () => {
    it('User A SELECT cannot return User B contractor row', async () => {
      const { data } = await clientA.from('contractors').select('id').eq('id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })

    it('User A UPDATE cannot modify User B contractor row', async () => {
      const { data } = await clientA
        .from('contractors')
        .update({ business_name: 'HACKED' })
        .eq('id', contractorBId)
        .select()
      // Either an error OR an empty data array (RLS filters out the row from the result)
      expect((data ?? []).length).toBe(0)
      // The row in DB must remain unchanged — verify via service role:
      const serviceClient = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: check } = await serviceClient
        .from('contractors')
        .select('business_name')
        .eq('id', contractorBId)
        .single()
      expect(check?.business_name).not.toBe('HACKED')
    })

    it('User A DELETE cannot remove User B contractor row', async () => {
      const { data } = await clientA.from('contractors').delete().eq('id', contractorBId).select()
      expect((data ?? []).length).toBe(0)
    })
  })

  // ===================== contractor_settings (Pattern B) =====================
  describe('contractor_settings', () => {
    it('User A cannot SELECT User B settings', async () => {
      const { data } = await clientA.from('contractor_settings').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })

    it('User A INSERT for User B contractor_id is blocked by WITH CHECK', async () => {
      const { error } = await clientA.from('contractor_settings').insert({
        contractor_id: contractorBId,
        business_name: 'HACKED',
      })
      // RLS WITH CHECK violation surfaces as an error (PostgREST 401/403 or PG row-level error)
      expect(error).not.toBeNull()
    })

    it('User A UPDATE on User B settings cannot modify rows', async () => {
      const { data } = await clientA
        .from('contractor_settings')
        .update({ business_name: 'HACKED' })
        .eq('contractor_id', contractorBId)
        .select()
      expect((data ?? []).length).toBe(0)
    })

    it('User A DELETE on User B settings cannot remove rows', async () => {
      const { data } = await clientA
        .from('contractor_settings')
        .delete()
        .eq('contractor_id', contractorBId)
        .select()
      expect((data ?? []).length).toBe(0)
    })
  })

  // ===================== calls =====================
  describe('calls', () => {
    it('User A cannot SELECT User B calls', async () => {
      const { data } = await clientA.from('calls').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
    it('User A INSERT for User B contractor_id is blocked', async () => {
      const { error } = await clientA.from('calls').insert({
        contractor_id: contractorBId,
        retell_call_id: 'attack-' + Date.now(),
      })
      expect(error).not.toBeNull()
    })
  })

  // ===================== leads =====================
  describe('leads', () => {
    it('User A cannot SELECT User B leads', async () => {
      const { data } = await clientA.from('leads').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
    it('User A INSERT for User B contractor_id is blocked', async () => {
      const { error } = await clientA.from('leads').insert({
        contractor_id: contractorBId,
        caller_phone: '+13055550000',
      })
      expect(error).not.toBeNull()
    })
  })

  // ===================== appointments =====================
  describe('appointments', () => {
    it('User A cannot SELECT User B appointments', async () => {
      const { data } = await clientA.from('appointments').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
    it('User A INSERT for User B contractor_id is blocked', async () => {
      const { error } = await clientA.from('appointments').insert({
        contractor_id: contractorBId,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      expect(error).not.toBeNull()
    })
  })

  // ===================== calendar_credentials =====================
  describe('calendar_credentials', () => {
    it('User A cannot SELECT User B calendar_credentials', async () => {
      const { data } = await clientA.from('calendar_credentials').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
    it('User A INSERT for User B contractor_id is blocked', async () => {
      const { error } = await clientA.from('calendar_credentials').insert({
        contractor_id: contractorBId,
        access_token: 'fake-ciphertext',
        refresh_token: 'fake-ciphertext',
        token_expiry: new Date().toISOString(),
      })
      expect(error).not.toBeNull()
    })
  })

  // ===================== notification_log =====================
  describe('notification_log', () => {
    it('User A cannot SELECT User B notification_log', async () => {
      const { data } = await clientA.from('notification_log').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
  })

  // ===================== notification_settings =====================
  describe('notification_settings', () => {
    it('User A cannot SELECT User B notification_settings', async () => {
      const { data } = await clientA.from('notification_settings').select('id').eq('contractor_id', contractorBId)
      expect(data ?? []).toHaveLength(0)
    })
  })

  // ===================== webhook_events (Pattern C — deny-all) =====================
  describe('webhook_events (Pattern C — deny-all)', () => {
    it('User A cannot SELECT any webhook_events row (deny-all)', async () => {
      const { data } = await clientA.from('webhook_events').select('id').limit(10)
      expect(data ?? []).toHaveLength(0)
    })
    it('User A cannot INSERT into webhook_events (deny-all)', async () => {
      const { error } = await clientA.from('webhook_events').insert({
        source: 'retell',
        event_type: 'attack',
        external_id: 'attack-' + Date.now(),
        payload: {},
      })
      expect(error).not.toBeNull()
    })
  })
})
