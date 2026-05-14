// src/app/api/onboarding/create-account/route.ts
// Source: RESEARCH.md Code Examples — Account Creation on First Login.
// Pattern: anon client (server.ts) for auth identity; service role for privileged inserts.
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { phoneSchema } from '@/lib/validations/onboarding'

// Normalize phone number to E.164 format for storage
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+?1?/, '')
  return `+1${digits}`
}

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
    const normalizedPhone = normalizePhoneNumber(body.data.phone_number)
    const { error: uErr } = await serviceClient
      .from('contractors')
      .update({
        email: user.email,
        phone_number: normalizedPhone,
        business_name: body.data.business_name,
        area_code: body.data.area_code,
      })
      .eq('id', existing.id)
    if (uErr) {
      console.error('[create-account] contractor update failed:', uErr.message)
      return NextResponse.json({ error: 'Failed to update account.' }, { status: 500 })
    }
    contractor_id = existing.id

    // Ensure contractor_settings exists (upsert guards against missing row on re-submission)
    const { error: sUpsertErr } = await serviceClient
      .from('contractor_settings')
      .upsert({ contractor_id, business_name: body.data.business_name }, { onConflict: 'contractor_id' })
    if (sUpsertErr) {
      console.error('[create-account] contractor_settings upsert failed:', sUpsertErr.message)
      return NextResponse.json({ error: 'Failed to update account settings.' }, { status: 500 })
    }
  } else {
    // 5. Insert contractors row
    const normalizedPhone = normalizePhoneNumber(body.data.phone_number)
    const { data: contractor, error: cErr } = await serviceClient
      .from('contractors')
      .insert({
        user_id: user.id,
        email: user.email,
        phone_number: normalizedPhone,
        business_name: body.data.business_name,
        area_code: body.data.area_code,
      })
      .select()
      .single()
    if (cErr || !contractor) {
      console.error('[create-account] contractor insert failed:', cErr?.message)
      return NextResponse.json({ error: 'Failed to create contractor.' }, { status: 500 })
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
      console.error('[create-account] contractor_settings insert failed:', sErr.message)
      // Roll back contractor row to keep state consistent
      const { error: rbErr } = await serviceClient.from('contractors').delete().eq('id', contractor_id)
      if (rbErr) {
        console.error('[create-account] ROLLBACK FAILED — orphaned contractor row:', contractor_id, rbErr.message)
      }
      return NextResponse.json({ error: 'Failed to complete account setup.' }, { status: 500 })
    }

    // 7. Insert notification_settings row (empty; populated in Plan 06 / Phase 5)
    const { error: nErr } = await serviceClient
      .from('notification_settings')
      .insert({ contractor_id })
    if (nErr) {
      console.error('[create-account] notification_settings insert failed:', nErr.message)
      // Attempt rollback — CASCADE on contractors DELETE removes contractor_settings automatically
      const { error: rbErr } = await serviceClient
        .from('contractors')
        .delete()
        .eq('id', contractor_id)
      if (rbErr) {
        console.error('[create-account] ROLLBACK FAILED — orphaned contractor row:', contractor_id, rbErr.message)
      }
      return NextResponse.json({ error: 'Failed to complete account setup.' }, { status: 500 })
    }
  }

  return NextResponse.json({ contractor_id })
}
