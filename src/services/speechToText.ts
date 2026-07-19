/**
 * Speech-to-text service using Workers AI Whisper (primary) via our
 * Pages Function proxy (/api/stt), and Web Speech API (fallback for
 * offline / no-server scenarios).
 */

// ── Capability checks ──────────────────────────────────────────────

/** Whether the browser supports the Web Speech API (SpeechRecognition). */
export function hasWebSpeech(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

// ── API proxy transcription ─────────────────────────────────────────

/**
 * Transcribe an audio blob using the /api/stt proxy which forwards to
 * Workers AI Whisper.
 *
 * @param audioBlob - The recorded audio as a Blob (webm/opus).
 * @returns The transcribed text.
 * @throws If the proxy request fails or the API returns an error.
 */
export async function transcribeWithProxy(audioBlob: Blob): Promise<string> {
  if (audioBlob.size === 0) {
    throw new Error('Empty audio recording.')
  }

  const formData = new FormData()
  formData.set('audio', audioBlob, 'recording.webm')

  let response: Response
  try {
    response = await fetch('/api/stt', {
      method: 'POST',
      body: formData,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      throw new Error(
        'Transcription service is not available. The API proxy may not be running.',
      )
    }
    throw new Error(`Transcription request failed: ${message}`)
  }

  if (!response.ok) {
    let errorMsg: string
    try {
      const body = await response.json()
      errorMsg = body.error || `API returned status ${response.status}`
    } catch {
      errorMsg = `API returned status ${response.status}`
    }

    if (response.status === 429 || response.status === 403) {
      throw new Error('Transcription rate limit reached. Please wait.')
    }
    throw new Error(errorMsg)
  }

  let result: { success: boolean; data?: { text: string }; error?: string }
  try {
    result = await response.json()
  } catch {
    throw new Error('Invalid response from transcription service.')
  }

  if (!result.success || !result.data?.text) {
    throw new Error(result.error || 'Transcription returned empty result.')
  }

  return result.data.text
}

// ── Web Speech API (streaming fallback) ────────────────────────────

/**
 * Start a Web Speech API recognition session for live (streaming) transcription.
 *
 * @param options - Callbacks for result, error, and end events.
 * @returns The active SpeechRecognition instance, or null if unavailable.
 */
export function startWebSpeech(options: {
  onResult: (text: string, final: boolean) => void
  onError: (error: string) => void
  onEnd: () => void
}): SpeechRecognition | null {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognitionAPI) return null

  const recognition = new SpeechRecognitionAPI()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      options.onResult(result[0].transcript, result.isFinal)
    }
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    options.onError(event.error)
  }

  recognition.onend = () => {
    options.onEnd()
  }

  recognition.start()
  return recognition
}

/**
 * Stop and abort a running Web Speech recognition session.
 * Safe to call even if the recognition has already ended.
 */
export function stopWebSpeech(recognition: SpeechRecognition): void {
  try {
    recognition.stop()
  } catch {
    // Ignore — already stopped / not started
  }
  try {
    recognition.abort()
  } catch {
    // Ignore — already aborted
  }
}

// ── MIME-type detection ────────────────────────────────────────────

/**
 * Returns the best supported audio MIME type for MediaRecorder.
 * Falls back to an empty string (browser default) if none match.
 */
export function getBestAudioMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}
