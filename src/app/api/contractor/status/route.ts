// GET — Returns the authenticated contractor's subscription status for the onboarding wizard.
// contractor_id is derived from the authenticated session, never from query params (IDOR prevention).
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('subscription_status, twilio_number, retell_agent_id')
    .eq('user_id', user.id)
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
