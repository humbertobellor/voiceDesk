import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const callId = searchParams.get('callId')

  if (!callId) {
    return NextResponse.json({ error: 'Missing callId' }, { status: 400 })
  }

  // Get user session
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get contractor for this user
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // Get the call to verify ownership and get recording_url
  const { data: call, error: callError } = await supabase
    .from('calls')
    .select('recording_url, contractor_id')
    .eq('id', callId)
    .eq('contractor_id', contractor.id)
    .single()

  if (callError || !call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  if (!call.recording_url) {
    return NextResponse.json({ error: 'No recording available' }, { status: 404 })
  }

  // Generate signed URL with 60 second TTL
  const supabaseBrowser = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Extract the path from the recording_url (storage path)
  const recordingPath = call.recording_url.replace(/^.*\/recordings\//, 'recordings/')

  const { data: signedData, error: signedError } = await supabaseBrowser
    .storage
    .from('recordings')
    .createSignedUrl(recordingPath, 60)

  if (signedError || !signedData?.signedUrl) {
    console.error('Failed to create signed URL:', signedError)
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}