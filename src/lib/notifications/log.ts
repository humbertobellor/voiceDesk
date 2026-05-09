import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { NotificationChannel } from '@/types/database'

export interface WriteNotificationLogParams {
  contractorId: string
  callId: string | null
  channel: NotificationChannel
  recipient: string
  message: string
}

// D-12: Write row BEFORE send (status='pending') — ensures log entry exists even if process crashes.
// Returns the new notification_log row UUID.
export async function writeNotificationLog(params: WriteNotificationLogParams): Promise<string> {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('notification_log')
    .insert({
      contractor_id: params.contractorId,
      call_id: params.callId,
      channel: params.channel,
      recipient: params.recipient,
      message: params.message,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[notification_log] insert failed: ${error?.message ?? 'no data returned'}`)
  }
  return data.id as string
}

// D-12: Update row AFTER send resolves — set status='sent'/'failed', sent_at, error.
export async function updateNotificationLog(
  logId: string,
  update: { status: 'sent' | 'failed'; sentAt?: string; error?: string }
): Promise<void> {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('notification_log')
    .update({
      status: update.status,
      sent_at: update.sentAt ?? (update.status === 'sent' ? new Date().toISOString() : null),
      error: update.error ?? null,
    })
    .eq('id', logId)

  if (error) {
    // Non-fatal — log the failure but do not throw (avoids cascading retry on a logging error)
    console.error(`[notification_log] update failed for log ${logId}:`, error.message)
  }
}
