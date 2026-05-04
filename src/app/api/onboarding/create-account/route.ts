// src/app/api/onboarding/create-account/route.ts
// Source: RESEARCH.md Code Examples — Account Creation on First Login.
// Pattern: anon client (server.ts) for auth identity; service role for privileged inserts.
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { phoneSchema } from '@/lib/validations/onboarding'

export async function POST(req: Request) {
  // 1. Verify caller is authenticated (anon client + getUser, NOT getSession)
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate request body with zod
  const body = phoneSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  // 3. Use service role for write operations (bypasses RLS for atomic multi-row inserts)
  const serviceClient = createServiceRoleClient()

  // 4. Check if a contractor row already exists for this user (idempotency on retry)
  const { data: existing } = await serviceClient
    .from('contractors')
    .select('id, phone_number')
    .eq('user_id', user.id)
    .maybeSingle()

  let contractor_id: string

  if (existing) {
    // Already exists — update phone_number and business_name (handles re-submission)
    const { error: uErr } = await serviceClient
      .from('contractors')
      .update({
        phone_number: body.data.phone_number,
        business_name: body.data.business_name,
        area_code: body.data.area_code,
      })
      .eq('id', existing.id)
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }
    contractor_id = existing.id
  } else {
    // 5. Insert contractors row
    const { data: contractor, error: cErr } = await serviceClient
      .from('contractors')
      .insert({
        user_id: user.id,
        phone_number: body.data.phone_number,
        business_name: body.data.business_name,
        area_code: body.data.area_code,
      })
      .select()
      .single()
    if (cErr || !contractor) {
      return NextResponse.json({ error: cErr?.message ?? 'Failed to create contractor' }, { status: 500 })
    }
    contractor_id = contractor.id

    // 6. Insert contractor_settings row using DB-level defaults.
    // supported_languages defaults to ['en'] (LANG-02 default; user expands in Plan 06 settings UI).
    // emergency_keywords + business_hours JSONB defaults pre-populated by migration 1 (D-10, D-11).
    const { error: sErr } = await serviceClient
      .from('contractor_settings')
      .insert({
        contractor_id,
        business_name: body.data.business_name,
      })
    if (sErr) {
      // Roll back contractor row to keep state consistent
      await serviceClient.from('contractors').delete().eq('id', contractor_id)
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }

    // 7. Insert notification_settings row (empty; populated in Plan 06 / Phase 5)
    const { error: nErr } = await serviceClient
      .from('notification_settings')
      .insert({ contractor_id })
    if (nErr) {
      await serviceClient.from('contractor_settings').delete().eq('contractor_id', contractor_id)
      await serviceClient.from('contractors').delete().eq('id', contractor_id)
      return NextResponse.json({ error: nErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ contractor_id })
}
