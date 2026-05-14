// GET — Returns contractor subscription status for onboarding wizard
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const contractorId = searchParams.get('contractor_id')

  if (!contractorId) {
    return NextResponse.json({ error: 'contractor_id required' }, { status: 400 })
  }

  const supabase = await createSupabaseServer()
  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('subscription_status, twilio_number, retell_agent_id')
    .eq('id', contractorId)
    .maybeSingle()

  if (error || !contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  return NextResponse.json({
    subscription_status: contractor.subscription_status,
    has_phone_number: !!contractor.twilio_number,
    has_retell_agent: !!contractor.retell_agent_id,
  })
}