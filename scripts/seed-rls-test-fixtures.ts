// scripts/seed-rls-test-fixtures.ts
// Seed two test contractors for RLS isolation testing.
// Run: npx tsx scripts/seed-rls-test-fixtures.ts
// Output: JWTs and contractor IDs printed to stdout — copy into .env.test.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function seedUser(email: string, password: string, businessName: string) {
  // Clean up any prior fixture user with this email (idempotent re-seed)
  try {
    const { data: users } = await admin.auth.admin.listUsers()
    const existingUser = users?.users?.find((u) => u.email === email)
    if (existingUser) {
      await admin.auth.admin.deleteUser(existingUser.id)
    }
  } catch {
    // Ignore errors if user doesn't exist
  }

  // 1. Create user
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr || !created.user) throw new Error(`createUser failed: ${cErr?.message}`)
  const userId = created.user.id

  // 2. Sign in to get JWT (use anon client, password grant)
  const { data: session, error: sErr } = await anon.auth.signInWithPassword({ email, password })
  if (sErr || !session.session) throw new Error(`signIn failed: ${sErr?.message}`)
  const jwt = session.session.access_token

  // 3. Insert contractor row using service role
  const { data: contractor, error: ctErr } = await admin
    .from('contractors')
    .insert({
      user_id: userId,
      email: email,
      phone_number: email.startsWith('test-a') ? '+13055550001' : '+13055550002',
      business_name: businessName,
      area_code: '305',
    })
    .select()
    .single()
  if (ctErr || !contractor) throw new Error(`contractor insert failed: ${ctErr?.message}`)

  // 4. Insert contractor_settings + notification_settings + a sample call + a sample lead
  await admin.from('contractor_settings').insert({ contractor_id: contractor.id, business_name: businessName })
  await admin.from('notification_settings').insert({ contractor_id: contractor.id })
  await admin.from('calls').insert({
    contractor_id: contractor.id,
    retell_call_id: `test-call-${userId}`,
    caller_phone: '+13055559999',
    status: 'completed',
  })
  await admin.from('leads').insert({
    contractor_id: contractor.id,
    caller_phone: '+13055559999',
    urgency: 'normal',
  })

  return { userId, jwt, contractorId: contractor.id }
}

async function main() {
  const a = await seedUser('test-a@voicedesk.test', 'test-password-a-123!', 'Test HVAC A')
  const b = await seedUser('test-b@voicedesk.test', 'test-password-b-123!', 'Test HVAC B')

  console.log('--- Copy into .env.test (or set in CI) ---')
  console.log(`TEST_USER_A_JWT=${a.jwt}`)
  console.log(`TEST_USER_B_JWT=${b.jwt}`)
  console.log(`TEST_CONTRACTOR_A_ID=${a.contractorId}`)
  console.log(`TEST_CONTRACTOR_B_ID=${b.contractorId}`)
  console.log('--- end ---')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
