import { useState, useEffect, useCallback } from 'react'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import {
  getConversationsByPerson,
  addConversationSegments,
} from '@/store/conversationStore'
import { useLLM } from '@/hooks/useLLM'
import { saveMemory } from '@/store/memoryStore'
import type { ConversationSegment } from '@/types/index.d.ts'

interface ConversationViewProps {
  personId?: string
  personName?: string
}

// ── Helper ─────────────────────────────────────────────────────────

/** Format a timestamp as a short time string (e.g. "2:30 PM"). */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Format duration in seconds to "M:SS". */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────────

export function ConversationView({
  personId,
  personName,
}: ConversationViewProps) {
  const [savedSegments, setSavedSegments] = useState<ConversationSegment[]>([])
  const [pendingSaved, setPendingSaved] = useState(false)

  const { extract } = useLLM()

  const {
    transcript,
    finalizedTranscripts,
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    duration,
  } = useSpeechToText({ personId, personName })

  // Load existing conversations on mount / person change
  useEffect(() => {
    if (!personId) {
      setSavedSegments([])
      return
    }

    let cancelled = false
    getConversationsByPerson(personId).then((segments) => {
      if (!cancelled) {
        setSavedSegments(segments)
      }
    })
    return () => {
      cancelled = true
    }
  }, [personId])

  // Build a merged list of saved + new (pending) segments
  const allSegments: ConversationSegment[] = [
    ...savedSegments,
    ...finalizedTranscripts.map((ft, i) => ({
      id: `pending-${i}-${ft.timestamp}`,
      personId: personId ?? '',
      timestamp: ft.timestamp,
      speaker: ft.speaker as 'user' | 'other',
      text: ft.text,
    })),
  ]

  const hasPending = finalizedTranscripts.length > 0

  // ── Save pending transcripts to IndexedDB ──────────────────────

  const handleSave = useCallback(async () => {
    if (!personId || finalizedTranscripts.length === 0) return

    setPendingSaved(true)
    try {
      const segments: ConversationSegment[] = finalizedTranscripts.map((ft) => ({
        id: crypto.randomUUID(),
        personId,
        timestamp: ft.timestamp,
        speaker: ft.speaker as 'user' | 'other',
        text: ft.text,
      }))

      await addConversationSegments(segments)

      // ── LLM extraction (fire-and-forget — don't block save flow) ──
      try {
        const fullTranscript = finalizedTranscripts
          .map((ft) => ft.text)
          .join(' ')

        const extracted = await extract(fullTranscript, personName)

        // Only save memory if extraction produced meaningful content
        if (
          extracted.summary &&
          !extracted.summary.includes('too short') &&
          !extracted.summary.includes('too short for meaningful')
        ) {
          await saveMemory({
            personId,
            timestamp: Date.now(),
            type: 'conversation',
            title: extracted.summary,
            content: JSON.stringify({
              actionItems: extracted.actionItems,
              personUpdates: extracted.personUpdates,
              keyMemories: extracted.keyMemories,
            }),
          })
        }
      } catch {
        // Extraction failed — save conversation anyway without structured data
      }

      // Reload from DB to get the full list
      const updated = await getConversationsByPerson(personId)
      setSavedSegments(updated)
    } finally {
      setPendingSaved(false)
    }
    // finalizedTranscripts will be empty on next recording
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, finalizedTranscripts, personName, extract])

  // ── Bubble rendering ──────────────────────────────────────────

  const isUser = (speaker: 'user' | 'other') => speaker === 'user'

  return (
    <div className="conversation-container">
      {/* Header */}
      {personName && (
        <div className="conversation-header">
          <span className="conversation-header-name">{personName}</span>
        </div>
      )}

      {/* Message list */}
      <div className="conversation-messages">
        {allSegments.length === 0 && !isRecording && !transcript ? (
          <div className="conversation-empty">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <p className="conversation-empty-text">
              No conversations yet. Tap record to start.
            </p>
          </div>
        ) : (
          <>
            {savedSegments.map((seg) => (
              <div
                key={seg.id}
                className={`conversation-bubble ${isUser(seg.speaker) ? 'conversation-bubble-user' : 'conversation-bubble-other'}`}
              >
                <p className="conversation-bubble-text">{seg.text}</p>
                <span className="conversation-timestamp">
                  {formatTime(seg.timestamp)}
                </span>
              </div>
            ))}

            {/* Separator between saved and pending */}
            {hasPending && savedSegments.length > 0 && (
              <div className="conversation-separator">
                <span>New Recording</span>
              </div>
            )}

            {/* Pending (not yet saved) transcripts */}
            {finalizedTranscripts.map((ft, i) => (
              <div
                key={`pending-${i}`}
                className={`conversation-bubble conversation-bubble-other`}
              >
                <p className="conversation-bubble-text">{ft.text}</p>
                <span className="conversation-timestamp">
                  {formatTime(ft.timestamp)}
                </span>
              </div>
            ))}

            {/* Live preview during recording */}
            {transcript && (
              <div className="conversation-bubble conversation-bubble-other transcript-preview">
                <p className="conversation-bubble-text">{transcript}</p>
              </div>
            )}
          </>
        )}

        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="conversation-transcribing">
            <div className="conversation-spinner" />
            <span>Transcribing...</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="conversation-error">
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="conversation-controls">
        {!isRecording ? (
          <button
            className="record-btn"
            onClick={startRecording}
            aria-label="Start recording"
            disabled={isTranscribing}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        ) : (
          <button
            className="stop-btn"
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            <div className="stop-btn-icon" />
          </button>
        )}

        {isRecording && (
          <span className="recording-duration">
            {formatDuration(duration)}
          </span>
        )}

        {/* Save / discard actions when pending */}
        {hasPending && !isRecording && !isTranscribing && (
          <div className="conversation-actions">
            <button
              className="conversation-btn conversation-btn-primary"
              onClick={handleSave}
              disabled={pendingSaved}
            >
              {pendingSaved ? 'Saving...' : 'Save Transcript'}
            </button>
            <button
              className="conversation-btn conversation-btn-secondary"
              onClick={cancelRecording}
              disabled={pendingSaved}
            >
              Discard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
