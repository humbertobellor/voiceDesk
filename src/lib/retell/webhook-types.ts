// src/lib/retell/webhook-types.ts
// Typed interfaces for Retell webhook payloads.
// Derived from PhoneCallResponse in retell-sdk/resources/call.d.ts (verified 2026-05-08).
// CRITICAL: call.call_analysis?.call_summary (NOT call.summary or call.analysis.summary)
// CRITICAL: call.duration_ms is milliseconds — divide by 1000 for calls.duration_seconds
// CRITICAL: store call.transcript_object in calls.transcript JSONB (NOT call.transcript string)
import 'server-only'

export interface RetellCallPayload {
  call_id: string
  agent_id: string
  from_number?: string | undefined  // E.164 caller phone — absent on anonymous/blocked calls → calls.caller_phone
  to_number: string            // Koolable number → calls.twilio_number
  direction: 'inbound' | 'outbound'
  call_status: string
  start_timestamp?: number     // ms epoch → new Date(start_timestamp) → calls.started_at
  end_timestamp?: number       // ms epoch → new Date(end_timestamp) → calls.ended_at
  duration_ms?: number         // milliseconds → Math.round(duration_ms / 1000) → calls.duration_seconds
  recording_url?: string       // D-16: store as-is in calls.recording_url
  transcript?: string          // plain speaker-labeled string — do NOT store in JSONB column
  transcript_object?: Array<{  // structured array → calls.transcript (JSONB)
    role: 'agent' | 'user' | 'transfer_target'
    content: string
    words: Array<{ word?: string; start?: number; end?: number }>
  }>
  call_analysis?: {
    call_summary?: string      // D-09: → calls.summary TEXT (NOT "summary", NOT "call_analysis.summary")
    call_successful?: boolean
    in_voicemail?: boolean
    user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown'
    custom_analysis_data?: unknown
  }
  disconnection_reason?: string
  metadata?: unknown
}

export interface RetellWebhookEvent {
  event: 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated' | string
  call: RetellCallPayload
}
