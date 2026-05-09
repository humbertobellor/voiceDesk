import 'server-only'
import type { NotificationChannel } from '@/types/database'

export interface WriteNotificationLogParams {
  contractorId: string
  callId: string | null
  channel: NotificationChannel
  recipient: string
  message: string
}

// Returns the new notification_log row id
export async function writeNotificationLog(_params: WriteNotificationLogParams): Promise<string> {
  throw new Error('not yet implemented')
}

export async function updateNotificationLog(
  _logId: string,
  _update: { status: 'sent' | 'failed'; sentAt?: string; error?: string }
): Promise<void> {
  throw new Error('not yet implemented')
}
