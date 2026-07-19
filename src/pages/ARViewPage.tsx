import { useState, useEffect, useRef } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { useFaceDetection } from '@/hooks/useFaceDetection'
import { useFaceRecognition } from '@/hooks/useFaceRecognition'
import { Camera } from '@/components/Camera'
import { ARView } from '@/components/ARView'
import {
  processDetection,
  confirmEnrollment,
  dismissEnrollment,
} from '@/services/enrollment'
import type { EnrollmentCandidate } from '@/services/enrollment'

/**
 * AR View page — the main camera-facing view of MemoryMirror.
 *
 * Shows live camera preview with real-time face detection overlay
 * (bounding boxes and facial landmarks). When a person is recognised
 * their name appears above the bounding box in green. Unrecognised
 * faces trigger an enrolment notification that allows the user to
 * name and save a new face record.
 */
export interface ARViewPageProps {
  /** Called when the user taps a recognized person's profile button */
  onPersonClick?: (personId: string, personName: string) => void
}

export function ARViewPage({ onPersonClick }: ARViewPageProps = {}) {
  const {
    stream,
    isLoading,
    error,
    facingMode,
    cameras,
    switchCamera,
    permissionDenied,
    retry,
  } = useCamera()

  // Expose the video element reactively via state setter callback
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  const {
    result,
    isModelLoaded,
    isLoading: modelLoading,
    error: modelError,
    fps,
  } = useFaceDetection({
    videoElement: videoEl,
    enabled: stream !== null && !isLoading && !error,
  })

  // Initialise recognition model (independent lifecycle)
  const {
    error: recognitionError,
    isModelLoaded: recognitionModelReady,
    isLoading: recognitionLoading,
  } = useFaceRecognition({
    videoElement: videoEl,
    enabled: stream !== null && !isLoading && !error,
  })

  // ── Enrollment / recognition state ───────────────────────────────
  const [pendingCandidate, setPendingCandidate] =
    useState<EnrollmentCandidate | null>(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [enrollName, setEnrollName] = useState('')
  const [recognitions, setRecognitions] = useState<
    Map<number, { name: string; id: string; confidence: number }>
  >(new Map())

  const lastProcessRef = useRef(0)

  // ── Process detections for recognition / enrollment ───────────────
  useEffect(() => {
    if (!videoEl || !result || result.detections.length === 0) {
      setRecognitions(new Map())
      return
    }

    // Throttle recognition pipeline to ~every 800ms so we don't
    // hammer the ONNX runtime on every detection frame.
    const now = Date.now()
    if (now - lastProcessRef.current < 800) return
    lastProcessRef.current = now

    // Capture non-null ref for use inside the async closure
    const safeResult = result

    let cancelled = false

    async function process(): Promise<void> {
      const map = new Map<
        number,
        { name: string; id: string; confidence: number }
      >()

      for (let i = 0; i < safeResult.detections.length; i++) {
        if (cancelled) return
        const face = safeResult.detections[i]
        const action = await processDetection(face, videoEl!)

        if (action.type === 'recognized') {
          map.set(i, {
            name: action.person.name,
            id: action.person.id,
            confidence: action.person.confidence,
          })
        } else if (action.type === 'unknown') {
          // Only show the first unknown candidate (debounced internally)
          setPendingCandidate((prev) => prev ?? action.candidate)
        }
      }

      if (!cancelled) {
        setRecognitions(map)
      }
    }

    process()

    return () => {
      cancelled = true
    }
    // Re-run when detection result changes (new frame data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, videoEl])

  // ── Enrollment confirmation ──────────────────────────────────────
  async function handleConfirmEnrollment(): Promise<void> {
    const trimmed = enrollName.trim()
    if (!trimmed) return
    try {
      await confirmEnrollment(trimmed)
    } catch (err) {
      console.error('[Enrollment] Failed to save face:', err)
    }
    setPendingCandidate(null)
    setShowNameInput(false)
    setEnrollName('')
  }

  function handleDismiss(): void {
    dismissEnrollment()
    setPendingCandidate(null)
    setShowNameInput(false)
    setEnrollName('')
  }

  // ── Derived state ────────────────────────────────────────────────
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const hasMultipleCameras = cameras.length > 1
  const isStreaming = stream !== null && !isLoading && !error
  const videoWidth = videoEl?.videoWidth ?? 0
  const videoHeight = videoEl?.videoHeight ?? 0

  return (
    <div className="ar-view-page">
      <ARView
        detectionResult={result}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
        mirrored={facingMode === 'user'}
        fps={fps}
        isModelLoaded={isModelLoaded}
        showDebug={isStreaming}
        recognitions={recognitions}
      >
        <Camera
          stream={stream}
          isLoading={isLoading}
          error={error}
          facingMode={facingMode}
          permissionDenied={permissionDenied}
          onRetry={retry}
          onSwitchCamera={hasMultipleCameras ? switchCamera : undefined}
          videoRefCallback={setVideoEl}
        />

        {/* Top info overlay while streaming */}
        {isStreaming && (
          <>
            <div className="camera-overlay-top">
              <div className="streaming-indicator">
                <span className="streaming-dot" />
                <span className="streaming-label">Live</span>
              </div>
              <p className="camera-hint">
                {isMobile
                  ? "Point camera at someone's face"
                  : 'Position the person in the frame'}
              </p>
            </div>

            {/* Model error overlays */}
            {modelError && (
              <div className="model-error-overlay">
                <span>Face detection: {modelError}</span>
              </div>
            )}
            {recognitionError && (
              <div className="model-error-overlay">
                <span>Face recognition: {recognitionError}</span>
              </div>
            )}
            {/* Recognition model status */}
            {isStreaming && !recognitionModelReady && !recognitionError && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 108,
                  right: 16,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  zIndex: 15,
                  pointerEvents: 'none',
                  opacity: 0.6,
                }}
              >
                {recognitionLoading ? 'Loading recognition model...' : 'Recognition offline'}
              </div>
            )}
          </>
        )}

        {/* ── Enrollment notification (unknown face) ─────────────── */}
        {pendingCandidate && !showNameInput && (
          <div className="enrollment-notification">
            <img
              className="enrollment-thumbnail"
              src={pendingCandidate.thumbnail}
              alt="Face thumbnail"
            />
            <div className="enrollment-info">
              <div className="enrollment-title">New face detected</div>
              <div className="enrollment-subtitle">
                Tap Enroll to add this person
              </div>
            </div>
            <div className="enrollment-actions">
              <button
                className="enrollment-btn enrollment-btn-primary"
                onClick={() => setShowNameInput(true)}
                type="button"
              >
                Enroll
              </button>
              <button
                className="enrollment-btn enrollment-btn-dismiss"
                onClick={handleDismiss}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Name input for enrollment confirmation ────────────── */}
        {showNameInput && (
          <div className="enrollment-notification">
            <div className="enrollment-info">
              <div className="enrollment-title">Enter name</div>
              <input
                className="enrollment-name-input"
                type="text"
                placeholder="Person's name..."
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmEnrollment()
                  } else if (e.key === 'Escape') {
                    handleDismiss()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="enrollment-actions">
              <button
                className="enrollment-btn enrollment-btn-primary"
                onClick={handleConfirmEnrollment}
                disabled={!enrollName.trim()}
                type="button"
              >
                Save
              </button>
              <button
                className="enrollment-btn enrollment-btn-dismiss"
                onClick={handleDismiss}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── View profile overlay for recognized faces ──────────── */}
        {recognitions.size > 0 && onPersonClick && (
          <div className="ar-view-profile-overlay">
            {Array.from(recognitions.entries()).map(([idx, person]) => (
              <button
                key={idx}
                className="ar-view-profile-btn"
                onClick={() => onPersonClick(person.id, person.name)}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                View {person.name}'s profile
              </button>
            ))}
          </div>
        )}
      </ARView>
    </div>
  )
}
