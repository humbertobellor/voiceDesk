-- 20260504000001_initial_schema.sql
-- Koolable Phase 1 Foundation: all 9 tables, RLS enabled, indexes, constraints.
-- Source: .planning/phases/01-foundation/01-RESEARCH.md (Full Database Schema)
-- Decisions: D-08, D-09, D-10, D-11, D-16, D-17, LANG-02

-- =========================================================================
-- Table 1: contractors
-- =========================================================================
CREATE TABLE contractors (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name          TEXT NOT NULL DEFAULT '',
  phone_number           TEXT,
  area_code              TEXT,
  twilio_number          TEXT,
  twilio_number_sid      TEXT,
  retell_agent_id        TEXT,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT NOT NULL DEFAULT 'trialing'
                         CHECK (subscription_status IN ('trialing','active','past_due','canceled')),
  subscription_tier      TEXT NOT NULL DEFAULT 'starter',
  timezone               TEXT NOT NULL DEFAULT 'America/New_York',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contractors_user_id ON contractors(user_id);
CREATE INDEX idx_contractors_stripe_customer_id ON contractors(stripe_customer_id);

-- =========================================================================
-- Table 2: contractor_settings (D-08, D-09, D-10, D-11, LANG-02)
-- =========================================================================
CREATE TABLE contractor_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  business_name       TEXT NOT NULL DEFAULT '',
  trade_type          TEXT NOT NULL DEFAULT 'hvac'
                      CHECK (trade_type IN ('hvac','plumbing','electrical','multi')),
  service_area        TEXT NOT NULL DEFAULT '',
  -- LANG-02: subset of supported language codes (ISO 639-1)
  supported_languages TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  business_hours      JSONB NOT NULL DEFAULT '{
    "monday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "tuesday":   {"open": "08:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "thursday":  {"open": "08:00", "close": "18:00", "enabled": true},
    "friday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "saturday":  {"open": "09:00", "close": "14:00", "enabled": false},
    "sunday":    {"open": "09:00", "close": "14:00", "enabled": false}
  }'::JSONB,
  -- D-11: per-language keyword defaults (gas/CO are also hard-coded in code)
  emergency_keywords  JSONB NOT NULL DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"],
    "ht": ["sant gaz", "pa gen chàfèt", "tiyo pete", "inondasyon", "pa gen kouran", "alàm CO", "sant brile"]
  }'::JSONB,
  after_hours_message TEXT NOT NULL DEFAULT 'You have reached our after-hours line. Please leave your name, phone number, and a brief description of your issue and we will call you back.',
  agent_voice         TEXT NOT NULL DEFAULT 'elevenlabs-myra',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id),
  -- LANG-02 + Pitfall 5: only allow ISO codes en/es/ht; reject empty arrays
  CONSTRAINT contractor_settings_supported_languages_valid
    CHECK (
      supported_languages <@ ARRAY['en','es','ht']::TEXT[]
      AND array_length(supported_languages, 1) >= 1
    )
);
ALTER TABLE contractor_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contractor_settings_contractor_id ON contractor_settings(contractor_id);

-- =========================================================================
-- Table 3: calls (populated by Phase 3 webhook handlers)
-- =========================================================================
CREATE TABLE calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  retell_call_id   TEXT NOT NULL UNIQUE,
  caller_phone     TEXT,
  caller_name      TEXT,
  twilio_number    TEXT,
  status           TEXT NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress','completed','failed')),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INT,
  recording_url    TEXT,
  transcript       JSONB,
  summary          TEXT,
  intent           TEXT
                   CHECK (intent IS NULL OR intent IN ('lead','emergency','info','no_action','unknown')),
  language         TEXT
                   CHECK (language IS NULL OR language IN ('en','es','ht')),
  is_after_hours   BOOLEAN NOT NULL DEFAULT FALSE,
  raw_metadata     JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_calls_contractor_id ON calls(contractor_id);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_intent ON calls(intent);
CREATE INDEX idx_calls_retell_call_id ON calls(retell_call_id);

-- =========================================================================
-- Table 4: leads (populated by Phase 3 + Phase 4)
-- =========================================================================
CREATE TABLE leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  call_id           UUID REFERENCES calls(id),
  caller_name       TEXT,
  caller_phone      TEXT NOT NULL,
  service_requested TEXT,
  service_type      TEXT
                    CHECK (service_type IS NULL OR service_type IN ('hvac','plumbing','electrical','general')),
  urgency           TEXT NOT NULL DEFAULT 'normal'
                    CHECK (urgency IN ('normal','urgent','emergency')),
  preferred_time    TEXT,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','booked','won','lost')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_contractor_id ON leads(contractor_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- =========================================================================
-- Table 5: appointments (Phase 4 booking — UNIQUE constraint = booking lock)
-- =========================================================================
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  lead_id          UUID REFERENCES leads(id),
  call_id          UUID REFERENCES calls(id),
  google_event_id  TEXT,
  calendar_id      TEXT NOT NULL DEFAULT 'primary',
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  service_address  TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('confirmed','cancelled','rescheduled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id, starts_at)
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appointments_contractor_id ON appointments(contractor_id);
CREATE INDEX idx_appointments_starts_at ON appointments(contractor_id, starts_at);

-- =========================================================================
-- Table 6: calendar_credentials (D-17 — encrypted token storage)
-- =========================================================================
CREATE TABLE calendar_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,    -- AES-256-GCM ciphertext (Plan 03 utility)
  refresh_token   TEXT NOT NULL,    -- AES-256-GCM ciphertext (Plan 03 utility)
  token_expiry    TIMESTAMPTZ NOT NULL,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  scope           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id)
);
ALTER TABLE calendar_credentials ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Table 7: webhook_events (D-16 — idempotency key)
-- =========================================================================
CREATE TABLE webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL
               CHECK (source IN ('retell','stripe','twilio')),
  event_type   TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed    BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- D-16: idempotency composite uniqueness — duplicate webhook deliveries are rejected at DB level
  UNIQUE (source, event_type, external_id)
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_webhook_events_unprocessed
  ON webhook_events(processed, created_at)
  WHERE processed = FALSE;

-- =========================================================================
-- Table 8: notification_log (Phase 5 will populate)
-- =========================================================================
CREATE TABLE notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  call_id       UUID REFERENCES calls(id),
  channel       TEXT NOT NULL
                CHECK (channel IN ('sms','whatsapp','telegram')),
  recipient     TEXT NOT NULL,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed')),
  sent_at       TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notification_log_contractor_id ON notification_log(contractor_id);
CREATE INDEX idx_notification_log_status ON notification_log(status);

-- =========================================================================
-- Table 9: notification_settings (Phase 5/7 populate)
-- =========================================================================
CREATE TABLE notification_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id         UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  sms_number            TEXT,
  whatsapp_number       TEXT,
  telegram_chat_id      TEXT,
  notify_on_lead        BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_emergency   BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_opted_in_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id)
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
