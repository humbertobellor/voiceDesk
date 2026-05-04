// Wave 0 stub — covers D-18. Requires TEST_USER_A_JWT, TEST_USER_B_JWT, TEST_CONTRACTOR_A_ID, TEST_CONTRACTOR_B_ID env vars set + Plan 02 migrations applied.
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

// Create two clients authenticated as different users
// (Uses Supabase test project with seeded test users)
const USER_A_TOKEN = process.env.TEST_USER_A_JWT!
const USER_B_TOKEN = process.env.TEST_USER_B_JWT!

// Unprivileged client for User A (respects RLS)
const clientA = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${USER_A_TOKEN}` } } }
)

const clientB = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${USER_B_TOKEN}` } } }
)

describe('RLS isolation — no cross-tenant data access', () => {
  let contractorA_id: string
  let contractorB_id: string

  beforeAll(async () => {
    // Seed: use service role to create two contractors
    // (seed script runs separately in CI)
    contractorA_id = process.env.TEST_CONTRACTOR_A_ID!
    contractorB_id = process.env.TEST_CONTRACTOR_B_ID!
  })

  it('User A cannot SELECT User B contractor row', async () => {
    const { data } = await clientA
      .from('contractors')
      .select('id')
      .eq('id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it('User A cannot UPDATE User B contractor row', async () => {
    const { error } = await clientA
      .from('contractors')
      .update({ business_name: 'HACKED' })
      .eq('id', contractorB_id)
    expect(error).not.toBeNull()  // or data returned is 0 rows updated
  })

  it('User A cannot INSERT contractor_settings for User B contractor_id', async () => {
    const { error } = await clientA
      .from('contractor_settings')
      .insert({ contractor_id: contractorB_id, business_name: 'HACKED' })
    expect(error).not.toBeNull()
  })

  it('User A cannot SELECT calls belonging to User B', async () => {
    const { data } = await clientA
      .from('calls')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  // Repeat SELECT / INSERT / UPDATE / DELETE for all 9 tables
  it.skip('User A cannot SELECT leads belonging to User B', async () => {
    const { data } = await clientA
      .from('leads')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it.skip('User A cannot SELECT appointments belonging to User B', async () => {
    const { data } = await clientA
      .from('appointments')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it.skip('User A cannot SELECT calendar_credentials belonging to User B', async () => {
    const { data } = await clientA
      .from('calendar_credentials')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it.skip('User A cannot SELECT notification_log belonging to User B', async () => {
    const { data } = await clientA
      .from('notification_log')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it.skip('User A cannot SELECT notification_settings belonging to User B', async () => {
    const { data } = await clientA
      .from('notification_settings')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })

  it.skip('User A cannot SELECT webhook_events belonging to User B', async () => {
    const { data } = await clientA
      .from('webhook_events')
      .select('id')
      .eq('contractor_id', contractorB_id)
    expect(data).toHaveLength(0)
  })
})
