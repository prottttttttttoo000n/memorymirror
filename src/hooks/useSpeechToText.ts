import { useState, useCallback, useRef, useEffect } from 'react'
import {
  hasWebSpeech,
  transcribeWithProxy,
  startWebSpeech,
  stopWebSpeech,
  getBestAudioMimeType,
} from '@/services/speechToText'
import { STT } from '@/lib/constants'

// ── Types ──────────────────────────────────────────────────────────

export interface TranscriptSegment {
  text: string
  timestamp: number
  speaker: 'user' | 'other'
}

interface UseSpeechToTextOptions {
  /** Automatically start recording on mount */
  autoStart?: boolean
  /** Person context for labeling transcripts */
  personId?: string
  personName?: string
}

interface UseSpeechToTextReturn {
  /** Current live transcript (interim / streaming preview) */
  transcript: string
  /** All finalized transcript segments from this session */
  finalizedTranscripts: TranscriptSegment[]
  /** Whether currently recording audio */
  isRecording: boolean
  /** Whether currently transcribing via API */
  isTranscribing: boolean
  /** Error message if something went wrong */
  error: string | null
  /** Start recording (requests mic permission) */
  startRecording: () => Promise<void>
  /** Stop recording and transcribe the audio */
  stopRecording: () => Promise<void>
  /** Cancel recording without transcribing (discards audio) */
  cancelRecording: () => void
  /** Recording duration in seconds */
  duration: number
}

// ── Hook ───────────────────────────────────────────────────────────

export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextReturn {
  const { autoStart = false } = options

  const [transcript, setTranscript] = useState('')
  const [finalizedTranscripts, setFinalizedTranscripts] = useState<TranscriptSegment[]>(
    []
  )
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  // Stable capability flags
  // The API proxy (/api/stt) is served from the same origin — always available to try.
  // Web Speech API provides real-time preview and fallback transcription.
  const usingProxy = true
  const usingWebSpeech = hasWebSpeech()

  // ── Refs ───────────────────────────────────────────────────────

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  // ── Cleanup helper (tears down timer, Web Speech, media stream) ──

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    if (recognitionRef.current) {
      stopWebSpeech(recognitionRef.current)
      recognitionRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    mediaRecorderRef.current = null
  }, [])

  // ── Cancel ──────────────────────────────────────────────────────
  // Must be defined before stopRecording because stopRecording uses it
  // indirectly via the onerror handler.

  const cancelRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    audioChunksRef.current = []
    cleanup()
    setIsRecording(false)
    setIsTranscribing(false)
    setTranscript('')
    setDuration(0)
  }, [cleanup])

  // ── Stop recording & transcribe ─────────────────────────────────

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    // Stop Web Speech preview first
    if (recognitionRef.current) {
      stopWebSpeech(recognitionRef.current)
      recognitionRef.current = null
    }

    // Clear duration timer
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    // Collect remaining audio chunks by waiting for onstop
    const chunks = await new Promise<Blob[]>((resolve) => {
      recorder.onstop = () => {
        resolve(audioChunksRef.current)
      }
      if (recorder.state === 'recording' || recorder.state === 'paused') {
        recorder.stop()
      } else {
        resolve(audioChunksRef.current)
      }
    })

    // Stop the media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    setDuration(0)
    setIsRecording(false)
    setTranscript('')

    // ── Transcribe via API proxy (primary) ──
    if (usingProxy) {
      setIsTranscribing(true)
      try {
        const mimeType = getBestAudioMimeType() || STT.AUDIO_MIME_TYPE
        const blob = new Blob(chunks, { type: mimeType })
        const text = await transcribeWithProxy(blob)
        if (text.trim()) {
          setFinalizedTranscripts((prev) => [
            ...prev,
            { text: text.trim(), timestamp: Date.now(), speaker: 'other' },
          ])
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Transcription failed'
        setError(message)
      } finally {
        setIsTranscribing(false)
      }
    }
    // If proxy transcription wasn't attempted, Web Speech finalized results
    // were already added to `finalizedTranscripts` during recording via onResult.

    audioChunksRef.current = []
    mediaRecorderRef.current = null
  }, [usingProxy])

  // ── Start recording ─────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null)
    setTranscript('')

    // Guard: check MediaRecorder support
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Audio recording is not supported on this device or browser'
      )
      return
    }

    // Guard: check that at least one STT method is available
    if (!usingProxy && !usingWebSpeech) {
      setError(
        'No speech-to-text method available. Use a browser that supports the Web Speech API.'
      )
      return
    }

    // Request microphone access
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError(
              'Microphone access denied. Please allow microphone access in your browser settings.'
            )
            break
          case 'NotFoundError':
            setError('No microphone found on this device.')
            break
          default:
            setError(`Microphone error: ${err.message}`)
        }
      } else {
        setError('Failed to access microphone')
      }
      return
    }

    streamRef.current = stream
    audioChunksRef.current = []

    // Pick best mime type
    const mimeType = getBestAudioMimeType()
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    )
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data)
      }
    }

    recorder.onerror = () => {
      setError('An error occurred during audio recording')
      cancelRecording()
    }

    recorder.start()
    setIsRecording(true)
    startTimeRef.current = Date.now()

    // Start duration interval with auto-stop
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setDuration(Math.floor(elapsed / 1000))
      if (elapsed >= STT.MAX_RECORDING_DURATION_MS) {
        stopRecording().catch((err: unknown) => {
          console.error(
            '[useSpeechToText] Auto-stop failed:',
            err instanceof Error ? err.message : String(err)
          )
        })
      }
    }, 1000)

    // Start Web Speech for live preview (if available)
    if (usingWebSpeech) {
      const recognition = startWebSpeech({
        onResult: (text: string, final: boolean) => {
          if (final && !usingProxy) {
            // Web Speech fallback: commit final results immediately
            setFinalizedTranscripts((prev) => [
              ...prev,
              { text, timestamp: Date.now(), speaker: 'other' },
            ])
            setTranscript('')
          } else {
            // API proxy primary or interim preview
            setTranscript(text)
          }
        },
        onError: (err: string) => {
          if (err !== 'no-speech' && err !== 'aborted') {
            console.warn('[useSpeechToText] Web Speech error:', err)
          }
        },
        onEnd: () => {
          // Auto-restart Web Speech while still recording
          if (mediaRecorderRef.current?.state === 'recording') {
            const rec = startWebSpeech({
              onResult: (text, isFinal) => {
                if (isFinal && !usingProxy) {
                  setFinalizedTranscripts((prev) => [
                    ...prev,
                    { text, timestamp: Date.now(), speaker: 'other' },
                  ])
                  setTranscript('')
                } else {
                  setTranscript(text)
                }
              },
              onError: (e: string) => {
                if (e !== 'no-speech' && e !== 'aborted') {
                  console.warn('[useSpeechToText] Web Speech error:', e)
                }
              },
              onEnd: () => {
                // Silently allow re-restart in the next cycle
              },
            })
            recognitionRef.current = rec
          }
        },
      })
      recognitionRef.current = recognition
    }
  }, [usingProxy, usingWebSpeech, cancelRecording, stopRecording])

  // ── Auto-start & cleanup on unmount ────────────────────────────

  useEffect(() => {
    if (autoStart) {
      startRecording()
    }
    return () => {
      cancelRecording()
    }
    // Stable callbacks — only run on mount / unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    transcript,
    finalizedTranscripts,
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    duration,
  }
}
