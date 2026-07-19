import { useState, useCallback, useRef } from 'react'
import { extractFromConversation } from '@/services/llmService'
import type { ExtractedData } from '@/services/llmService'

// ── Types ──────────────────────────────────────────────────────────

export interface UseLLMOptions {
  /** Automatically extract after recording stops (not yet implemented) */
  autoExtract?: boolean
}

export interface UseLLMReturn {
  /** Extract structured data from a conversation transcript */
  extract: (transcript: string, personName?: string) => Promise<ExtractedData>
  /** Whether an extraction is currently in progress */
  isExtracting: boolean
  /** Whether the LLM service is available (always true — it calls our own API) */
  isAvailable: boolean
  /** Last extraction error message, or null if no error */
  error: string | null
  /** Clear the current error */
  clearError: () => void
}

// ── Rate limiting ──────────────────────────────────────────────────

/** Minimum interval between extraction calls (ms) — 300 RPM limit, so 200ms between is fine, but be courteous */
const MIN_INTERVAL_MS = 500

// ── Hook ───────────────────────────────────────────────────────────

export function useLLM(_options: UseLLMOptions = {}): UseLLMReturn {
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs for rate limiting and concurrency control
  const isExtractingRef = useRef(false)
  const lastCallRef = useRef(0)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const extract = useCallback(
    async (transcript: string, personName?: string): Promise<ExtractedData> => {
      // Prevent concurrent extractions
      if (isExtractingRef.current) {
        throw new Error('An extraction is already in progress.')
      }

      // Enforce minimum interval between calls
      const now = Date.now()
      const elapsed = now - lastCallRef.current
      if (elapsed < MIN_INTERVAL_MS && lastCallRef.current > 0) {
        const waitMs = MIN_INTERVAL_MS - elapsed
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }

      isExtractingRef.current = true
      setIsExtracting(true)
      setError(null)

      try {
        const result = await extractFromConversation(transcript, personName)
        lastCallRef.current = Date.now()
        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown extraction error'
        setError(message)
        // Re-throw so callers can handle the failure (e.g. save without extraction)
        throw err
      } finally {
        isExtractingRef.current = false
        setIsExtracting(false)
      }
    },
    [],
  )

  return {
    extract,
    isExtracting,
    isAvailable: true,
    error,
    clearError,
  }
}
