/**
 * LLM service for structured data extraction from conversation transcripts.
 *
 * Calls the Cloudflare Pages Function proxy (/api/llm) which forwards
 * to Workers AI Llama 3.1 8B. Keeps Cloudflare API credentials server-side.
 */

import { LLM } from '@/lib/constants'

// ── Types ──────────────────────────────────────────────────────────

/** Structured data extracted from a conversation transcript */
export interface ExtractedData {
  /** 2-3 sentence factual summary of the conversation */
  summary: string
  /** Specific tasks or action items mentioned (max 5) */
  actionItems: string[]
  /** New information about the person (preferences, health, events, etc., max 5) */
  personUpdates: string[]
  /** Notable moments or important statements (max 3) */
  keyMemories: string[]
}

/** Response shape from our /api/llm proxy */
interface LlmApiResponse {
  success: boolean
  data?: { text: string }
  error?: string
}

// ── System prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are analyzing a conversation transcript for a memory assistant app.
Extract the following in JSON format only — no markdown, no code fences, no explanation:
{
  "summary": "2-3 sentence summary of the conversation",
  "actionItems": ["action item 1", "action item 2"],
  "personUpdates": ["new fact about the person", "preference mentioned"],
  "keyMemories": ["notable moment or statement"]
}

Rules:
- summary: concise, factual, 2-3 sentences
- actionItems: specific tasks mentioned (max 5). Use empty array if none.
- personUpdates: new information about the person (max 5). Use empty array if none.
- keyMemories: important statements or events (max 3). Use empty array if none.
- If the conversation is too short or meaningless, return empty arrays and "Conversation too short for meaningful extraction."
- Output ONLY valid JSON. No surrounding text, no backticks, no markdown.`

// ── Helper ─────────────────────────────────────────────────────────

/**
 * Safely parse the JSON response from the LLM into ExtractedData.
 * Falls back gracefully if the response is malformed.
 */
function parseExtractedData(content: string): ExtractedData {
  try {
    const parsed = JSON.parse(content)

    return {
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : 'No summary available.',
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.filter(
            (item: unknown): item is string => typeof item === 'string',
          )
        : [],
      personUpdates: Array.isArray(parsed.personUpdates)
        ? parsed.personUpdates.filter(
            (item: unknown): item is string => typeof item === 'string',
          )
        : [],
      keyMemories: Array.isArray(parsed.keyMemories)
        ? parsed.keyMemories.filter(
            (item: unknown): item is string => typeof item === 'string',
          )
        : [],
    }
  } catch {
    // If parsing fails, try to extract JSON from the response using regex
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return parseExtractedData(jsonMatch[0])
      } catch {
        // fall through
      }
    }
    return fallbackExtracted('Failed to parse LLM response.')
  }
}

/**
 * Return a fallback ExtractedData object when extraction fails.
 */
function fallbackExtracted(summary: string): ExtractedData {
  return {
    summary,
    actionItems: [],
    personUpdates: [],
    keyMemories: [],
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send a conversation transcript to the LLM proxy and return structured data.
 *
 * @param transcript - The full conversation transcript text
 * @param personName - Optional name of the person in the conversation
 * @returns ExtractedData with summary, action items, person updates, and key memories
 * @throws If the API is unavailable, rate limited, or returns an error
 */
export async function extractFromConversation(
  transcript: string,
  personName?: string,
): Promise<ExtractedData> {
  const userMessage = `Person: ${personName || 'Unknown'}
Conversation:
${transcript}`

  let response: Response
  try {
    response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: LLM.TEMPERATURE,
        max_tokens: LLM.MAX_TOKENS,
      }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      throw new Error(
        'LLM service is not available. The API proxy may not be running.',
      )
    }
    throw new Error(`LLM request failed: ${message}`)
  }

  // ── Handle HTTP errors ────────────────────────────────────────
  if (!response.ok) {
    let errorBody: LlmApiResponse | null = null
    try {
      errorBody = await response.json()
    } catch {
      // ignore parse errors
    }

    const errorMsg = errorBody?.error || `API returned status ${response.status}`

    if (response.status === 429 || response.status === 403) {
      throw new Error('Rate limit reached. Please wait a moment before trying again.')
    }
    if (response.status >= 500) {
      throw new Error(`LLM service error: ${errorMsg}`)
    }

    throw new Error(errorMsg)
  }

  // ── Parse response ────────────────────────────────────────────
  let result: LlmApiResponse
  try {
    result = await response.json()
  } catch {
    throw new Error('Invalid response from LLM service.')
  }

  if (!result.success || !result.data?.text) {
    throw new Error(result.error || 'LLM service returned an empty response.')
  }

  return parseExtractedData(result.data.text)
}
