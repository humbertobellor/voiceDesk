// src/lib/classification/extract-trade.ts
// GPT-4o trade-specific data extraction — second LLM call in the D-08 pipeline.
// D-10: trade-specific Zod schemas per contractor's trade_type.
// Uses gpt-4o (not gpt-4o-mini) for better structured extraction accuracy.
// Returns null for no_action intent to avoid wasted API calls (D-13).
import 'server-only'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { getOpenAIClient } from '@/lib/openai/client'

// D-10: Per-trade extraction schemas
// OpenAI structured output requires optional fields to use .nullish() (nullable + optional)
// See: https://platform.openai.com/docs/guides/structured-outputs (all fields must be required or nullable)

// D-11: Phase 4 extension — appointment booking fields added to all four schemas.
// These fields capture what the Retell agent confirmed during the call.
// MUST use .nullish() (NOT .optional()) — OpenAI structured outputs requires all fields to be
// either required or nullable. .nullish() = z.string().nullable().optional() which maps to
// { type: 'string', nullable: true } in JSON Schema — accepted by zodResponseFormat.
const appointmentFields = {
  confirmed_appointment_time: z.string().nullish(),
  // ISO datetime without timezone suffix: "2026-05-12T10:00:00"
  // The extraction prompt instructs LLM to use contractor's local time without 'Z' or offset.
  // IMPORTANT: Validate with Date.parse() before use in Inngest — LLM compliance is not guaranteed.
  // Treat as local contractor time; convert to UTC with fromZonedTime() before DB insert.

  service_address: z.string().nullish(),
  // Full address or intersection as spoken by caller: "123 Main St, Miami FL" or "Main and Flagler"
  // null if caller did not provide
}

const HvacSchema = z.object({
  system_age: z.string().nullish(),
  issue_type: z.enum(['heating', 'cooling', 'other']),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
  ...appointmentFields,
})

const PlumbingSchema = z.object({
  leak_type: z.enum(['active', 'slow', 'none']),
  repair_type: z.string().nullish(),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
  ...appointmentFields,
})

const ElectricalSchema = z.object({
  safety_issue: z.boolean(),
  repair_type: z.string().nullish(),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
  ...appointmentFields,
})

// Fallback schema for multi-trade or unknown trade types
const GeneralSchema = z.object({
  issue_description: z.string().nullish(),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
  ...appointmentFields,
})

export type TradeExtractionResult =
  | z.infer<typeof HvacSchema>
  | z.infer<typeof PlumbingSchema>
  | z.infer<typeof ElectricalSchema>
  | z.infer<typeof GeneralSchema>

function getSchemaForTrade(trade?: string): { schema: z.ZodObject<z.ZodRawShape>; name: string } {
  switch (trade) {
    case 'hvac': return { schema: HvacSchema, name: 'hvac_extraction' }
    case 'plumbing': return { schema: PlumbingSchema, name: 'plumbing_extraction' }
    case 'electrical': return { schema: ElectricalSchema, name: 'electrical_extraction' }
    default: return { schema: GeneralSchema, name: 'general_extraction' }
  }
}

function buildExtractionPrompt(trade?: string): string {
  return `Extract structured information from this ${trade ?? 'general'} contractor call transcript.
Fill in only what was explicitly stated by the caller. Use your best judgment for urgency.
Urgency guide: emergency = happening now + safety risk, urgent = active damage or no functionality, normal = maintenance or future repair.
If the agent confirmed an appointment time during the call, extract it as confirmed_appointment_time in ISO format (YYYY-MM-DDTHH:MM:SS) without timezone suffix, using the contractor's local time. If no appointment was confirmed, return null for confirmed_appointment_time.
If the caller provided a service address, extract it as service_address (include street number, street name, city if mentioned). If no address was provided, return null for service_address.`
}

/**
 * Extracts trade-specific structured data from the call transcript.
 * Returns null if the transcript is empty or not worth extracting (e.g., no_action calls).
 * detectedTrade: from classification step or contractor.trade_type
 */
export async function extractTradeData(
  transcriptText: string,
  detectedTrade?: string
): Promise<TradeExtractionResult | null> {
  if (!transcriptText?.trim()) return null

  const { schema, name } = getSchemaForTrade(detectedTrade)
  const client = getOpenAIClient()

  const completion = await client.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildExtractionPrompt(detectedTrade) },
      { role: 'user', content: transcriptText },
    ],
    response_format: zodResponseFormat(schema, name),
  })

  const result = completion.choices[0]?.message?.parsed
  if (!result) {
    console.error('[extract-trade] OpenAI returned no parsed result for trade:', detectedTrade)
    return null
  }
  return result as TradeExtractionResult
}
