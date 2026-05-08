// src/lib/classification/classify-intent.ts
// GPT-4o-mini intent classification with Zod-enforced structured output.
// D-07/D-08: called after hard-code emergency check; result can be overridden by D-06 in Inngest.
// D-12: Intent enum values MUST match Phase 1 schema CHECK constraint exactly:
//   'lead' | 'emergency' | 'info' | 'no_action' — NOT 'general_inquiry', NOT 'unknown'
// D-13: isShortCall=true is passed in prompt context for calls < 15 seconds.
import 'server-only'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { getOpenAIClient } from '@/lib/openai/client'

// D-12: enum values must match Phase 1 schema CHECK constraint exactly
// OpenAI structured output requires optional fields to be .nullish() (nullable + optional)
// See: https://platform.openai.com/docs/guides/structured-outputs (all fields must be required or nullable)
export const ClassificationSchema = z.object({
  intent: z.enum(['lead', 'emergency', 'info', 'no_action']),
  detected_trade: z.enum(['hvac', 'plumbing', 'electrical', 'other']).nullish(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export type ClassificationResult = z.infer<typeof ClassificationSchema>

function buildClassificationPrompt(isShortCall: boolean): string {
  const shortCallNote = isShortCall
    ? '\n\nNOTE: This call was very short (under 15 seconds). If the caller did not express a clear need, classify as no_action.'
    : ''
  return `You are classifying inbound calls to HVAC, plumbing, and electrical contractors.

Classify the call into exactly one intent:
- "lead": caller has a service need (repair, installation, maintenance, estimate, general inquiry with clear interest)
- "emergency": caller describes an urgent safety or damage situation happening now (flooding, gas issue confirmed NOW, no power, sparking)
- "info": caller asking questions without a clear service need, or general inquiry without urgency
- "no_action": caller hung up, wrong number, spam, or call too short to determine intent

IMPORTANT: Gas smell and CO alarm are handled separately — if you see these in the transcript, still classify normally; the calling system will override with 'emergency' anyway.

Also identify the trade type if determinable: hvac, plumbing, electrical, or other.${shortCallNote}`
}

export async function classifyIntent(
  transcriptText: string,
  isShortCall: boolean
): Promise<ClassificationResult> {
  const client = getOpenAIClient()
  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildClassificationPrompt(isShortCall) },
      { role: 'user', content: transcriptText || '[empty transcript]' },
    ],
    response_format: zodResponseFormat(ClassificationSchema, 'classification'),
  })
  const result = completion.choices[0]?.message?.parsed
  if (!result) throw new Error('[classify-intent] OpenAI returned no parsed result')
  return result
}
