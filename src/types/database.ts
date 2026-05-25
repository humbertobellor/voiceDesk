// src/types/database.ts
// Hand-rolled types matching .planning/phases/01-foundation/01-RESEARCH.md Full Database Schema.
// Future: replace with `supabase gen types typescript --linked > src/types/database.ts` output.

export type Language = 'en' | 'es'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type TradeType = 'hvac' | 'plumbing' | 'electrical' | 'multi'
export type CallStatus = 'in_progress' | 'completed' | 'failed'
export type CallIntent = 'lead' | 'emergency' | 'info' | 'no_action' | 'unknown'
export type LeadStatus = 'new' | 'contacted' | 'booked' | 'won' | 'lost'
export type Urgency = 'normal' | 'urgent' | 'emergency'
export type AppointmentStatus = 'confirmed' | 'cancelled' | 'rescheduled'
export type WebhookSource = 'retell' | 'stripe' | 'twilio'
export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Contractor {
  id: string
  user_id: string
  business_name: string
  phone_number: string | null
  area_code: string | null
  twilio_number: string | null
  twilio_number_sid: string | null
  retell_agent_id: string | null
  retell_llm_id: string | null
  agent_sync_status: 'synced' | 'failed' | 'pending' | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus
  subscription_tier: string
  is_active: boolean
  trial_ends_at: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface BusinessHoursDay {
  open: string  // HH:MM
  close: string // HH:MM
  enabled: boolean
}

export interface BusinessHours {
  [day: string]: BusinessHoursDay
  monday: BusinessHoursDay
  tuesday: BusinessHoursDay
  wednesday: BusinessHoursDay
  thursday: BusinessHoursDay
  friday: BusinessHoursDay
  saturday: BusinessHoursDay
  sunday: BusinessHoursDay
}

export interface EmergencyKeywords {
  en: string[]
  es: string[]
}

export interface ContractorSettings {
  id: string
  contractor_id: string
  business_name: string
  trade_type: TradeType
  service_area: string
  supported_languages: Language[]
  business_hours: BusinessHours
  appointment_duration_minutes: number
  emergency_keywords: EmergencyKeywords
  after_hours_message: string
  agent_voice: string
  created_at: string
  updated_at: string
}

export interface Call {
  id: string
  contractor_id: string
  retell_call_id: string
  caller_phone: string | null
  caller_name: string | null
  twilio_number: string | null
  status: CallStatus
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  recording_url: string | null
  transcript: unknown | null
  summary: string | null
  intent: CallIntent | null
  language: Language | null
  is_after_hours: boolean
  raw_metadata: unknown | null
  created_at: string
}

export interface Lead {
  id: string
  contractor_id: string
  call_id: string | null
  caller_name: string | null
  caller_phone: string
  service_requested: string | null
  service_type: TradeType | 'general' | null
  urgency: Urgency
  preferred_time: string | null
  notes: string | null
  status: LeadStatus
  booking_conflict: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  contractor_id: string
  lead_id: string | null
  call_id: string | null
  google_event_id: string | null
  calendar_id: string
  starts_at: string
  ends_at: string
  service_address: string | null
  notes: string | null
  status: AppointmentStatus
  google_sync_status: 'pending' | 'synced' | 'failed' | 'skipped'
  created_at: string
}

export interface CalendarCredentials {
  id: string
  contractor_id: string
  access_token: string  // AES-256-GCM ciphertext (never plaintext)
  refresh_token: string // AES-256-GCM ciphertext (never plaintext)
  token_expiry: string
  calendar_id: string
  scope: string | null
  created_at: string
  updated_at: string
}

export interface WebhookEvent {
  id: string
  source: WebhookSource
  event_type: string
  external_id: string
  payload: unknown
  processed: boolean
  processed_at: string | null
  error: string | null
  created_at: string
}

export interface NotificationLog {
  id: string
  contractor_id: string
  call_id: string | null
  channel: NotificationChannel
  recipient: string
  message: string | null
  status: NotificationStatus
  sent_at: string | null
  error: string | null
  created_at: string
}

// Phase 12: In-app notification persistence (BELL-04)
export interface AppNotification {
  id: string
  contractor_id: string
  event_type: 'lead' | 'emergency' | 'payment_failure' | 'system'
  title: string
  body: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationSettings {
  id: string
  contractor_id: string
  sms_number: string | null
  whatsapp_number: string | null
  telegram_chat_id: string | null
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean  // Phase 5: controls info-intent notifications
  notify_sms_enabled: boolean         // Phase 10: gate SMS dispatch (D-02)
  notify_whatsapp_enabled: boolean    // Phase 10: gate WhatsApp dispatch (D-02)
  notify_telegram_enabled: boolean    // Phase 10: gate Telegram dispatch (D-02)
  whatsapp_opted_in_at: string | null
  notify_email_enabled: boolean        // Phase 12 — email opt-in flag (D-06)
  email_address: string | null         // Phase 12 — contractor-supplied send-to address (D-06)
  notify_on_payment_failure: boolean   // Phase 12 — gating flag for payment failure emails (D-06)
  created_at: string
  updated_at: string
}
