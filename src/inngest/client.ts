// src/inngest/client.ts
// Inngest client singleton for VoiceDesk.
// D-12: Inngest provides durable retry for Retell agent sync failures (max 5 retries).
// NOTE: import 'server-only' to prevent accidental client-side bundle inclusion.
import 'server-only'
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'voicedesk' })
