import { useState, useEffect, useRef } from 'react'
import {
  initializeFaceDetector,
  isFaceDetectorReady,
  detectFaces,
  disposeFaceDetector,
} from '@/services/faceDetection'
import type { FaceDetectionResult } from '@/types/index.d.ts'
import { FACE_DETECTION } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────

export interface UseFaceDetectionOptions {
  /** The HTMLVideoElement to run detection on */
  videoElement: HTMLVideoElement | null
  /** Whether detection should be running */
  enabled: boolean
  /** Minimum time between frames in ms (default: 66 = ~15fps) */
  intervalMs?: number
  /** Minimum confidence for detections (default: 0.5) */
  minConfidence?: number
}

export interface UseFaceDetectionResult {
  /** Latest detection result, or null if not yet available */
  result: FaceDetectionResult | null
  /** Whether the MediaPipe model is loaded and ready */
  isModelLoaded: boolean
  /** Whether the model is currently being initialized */
  isLoading: boolean
  /** Error message if model initialization failed */
  error: string | null
  /** Actual achieved detection FPS */
  fps: number
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * React hook that manages the face detection lifecycle.
 *
 * Automatically initializes the MediaPipe FaceDetector on mount,
 * runs detection at ~15fps while enabled, and cleans up on unmount.
 */
export function useFaceDetection({
  videoElement,
  enabled,
  intervalMs = FACE_DETECTION.INTERVAL_MS,
  minConfidence = FACE_DETECTION.MIN_CONFIDENCE,
}: UseFaceDetectionOptions): UseFaceDetectionResult {
  const [result, setResult] = useState<FaceDetectionResult | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)

  const rafIdRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const fpsFrameCountRef = useRef(0)
  const fpsLastTimeRef = useRef(0)

  // ── Initialize FaceDetector on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false

    // If the model was already initialized in a previous mount, skip loading
    if (isFaceDetectorReady()) {
      setIsModelLoaded(true)
      setIsLoading(false)
      return
    }

    async function init(): Promise<void> {
      setIsLoading(true)
      try {
        const success = await initializeFaceDetector()
        if (cancelled) return
        if (success) {
          setIsModelLoaded(true)
          setError(null)
        } else {
          setError('Failed to load face detection model')
        }
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize face detection'
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  // ── Detection loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !videoElement || !isModelLoaded) {
      // Clear stale results and reset FPS when stopping
      setResult(null)
      setFps(0)
      fpsFrameCountRef.current = 0
      fpsLastTimeRef.current = 0
      return
    }

    // Capture non-null video reference for use inside detectLoop
    const safeVideo: HTMLVideoElement = videoElement

    function detectLoop(timestamp: number): void {
      // Throttle frame rate
      if (timestamp - lastFrameTimeRef.current >= intervalMs) {
        // Skip if the video isn't playing yet
        if (
          !safeVideo.paused &&
          safeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          const detectionResult = detectFaces(safeVideo)

          // Apply confidence filter
          if (minConfidence > 0) {
            const filtered = detectionResult.detections.filter(
              (d) => d.score >= minConfidence
            )
            setResult({
              detections: filtered,
              timestamp: detectionResult.timestamp,
            })
          } else {
            setResult(detectionResult)
          }
        }

        lastFrameTimeRef.current = timestamp

        // Track actual FPS (rolling count each second)
        fpsFrameCountRef.current++
        if (timestamp - fpsLastTimeRef.current >= 1000) {
          setFps(fpsFrameCountRef.current)
          fpsFrameCountRef.current = 0
          fpsLastTimeRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(detectLoop)
    }

    // Reset counters on start/restart
    lastFrameTimeRef.current = 0
    fpsFrameCountRef.current = 0
    fpsLastTimeRef.current = 0

    rafIdRef.current = requestAnimationFrame(detectLoop)

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
    }
  }, [enabled, videoElement, isModelLoaded, intervalMs, minConfidence])

  // ── Cleanup FaceDetector on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      disposeFaceDetector()
    }
  }, [])

  return { result, isModelLoaded, isLoading, error, fps }
}
