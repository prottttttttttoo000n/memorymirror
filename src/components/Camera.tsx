import { useRef, useEffect, useCallback, type JSX } from 'react'

/** Props for the Camera component */
export interface CameraProps {
  /** The active media stream to display */
  stream: MediaStream | null
  /** Whether the camera is initializing */
  isLoading: boolean
  /** User-friendly error message, or null */
  error: string | null
  /** Current facing mode */
  facingMode: 'user' | 'environment'
  /** Whether camera permission was denied by the user */
  permissionDenied: boolean
  /** Mirror the video horizontally (default true for front camera selfie view) */
  mirrored?: boolean
  /** Called when the user clicks retry after an error */
  onRetry?: () => void
  /** Called when the user clicks the switch-camera button */
  onSwitchCamera?: () => void
  /** Additional CSS class name */
  className?: string
  /** Called with the HTMLVideoElement when it mounts (for parent ref forwarding) */
  videoRefCallback?: (el: HTMLVideoElement | null) => void
}

/**
 * Camera component that renders a live video preview from a MediaStream.
 * Handles loading, error, and permission-denied states with appropriate UI.
 */
export function Camera({
  stream,
  isLoading,
  error,
  facingMode,
  permissionDenied,
  mirrored = true,
  onRetry,
  onSwitchCamera,
  className,
  videoRefCallback,
}: CameraProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Callback ref to expose the video element to the parent
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      videoRefCallback?.(el)
    },
    [videoRefCallback]
  )

  // Attach stream to video element whenever it changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (stream && video.srcObject !== stream) {
      video.srcObject = stream
    }
  }, [stream])

  // Mirror video for front camera (selfie view)
  const shouldMirror = facingMode === 'user' && mirrored

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className={`camera-container ${className ?? ''}`}>
        <div className="camera-loading">
          <div className="camera-spinner" />
          <p className="camera-loading-text">Starting camera...</p>
        </div>
      </div>
    )
  }

  // --- Permission denied state ---
  if (permissionDenied) {
    return (
      <div className={`camera-container ${className ?? ''}`}>
        <div className="camera-permission-denied">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <h3 className="camera-permission-title">Camera Access Required</h3>
          <p className="camera-permission-text">
            Please allow camera access in your browser settings to use the AR view.
          </p>
          {onRetry && (
            <button className="camera-retry-btn" onClick={onRetry} type="button">
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (error && !stream) {
    return (
      <div className={`camera-container ${className ?? ''}`}>
        <div className="camera-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="camera-error-text">{error}</p>
          {onRetry && (
            <button className="camera-retry-btn" onClick={onRetry} type="button">
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- Active video preview ---
  return (
    <div className={`camera-container ${className ?? ''}`}>
      <video
        ref={setVideoRef}
        className="camera-video"
        style={{
          transform: shouldMirror ? 'scaleX(-1)' : undefined,
        }}
        autoPlay
        playsInline
        muted
        aria-label="Camera preview"
      />

      {/* Switch-camera FAB */}
      {onSwitchCamera && (
        <button
          className="camera-switch-btn"
          onClick={onSwitchCamera}
          type="button"
          aria-label="Switch camera"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
            <path d="M15 9l3 3-3 3" />
            <path d="M9 15l-3-3 3-3" />
          </svg>
        </button>
      )}
    </div>
  )
}
