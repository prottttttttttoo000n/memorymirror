/**
 * React hook that manages the face recognition lifecycle.
 *
 * Initializes the MobileFaceNet ONNX model on mount, runs periodic
 * recognition on the video feed (using face detection regions when
 * available), and cleans up on unmount.
 *
 * Designed to work alongside useFaceDetection — the face detector
 * provides per-frame face regions that this hook crops and embeds.
 */

import { useState, useEffect, useRef } from 'react'
import {
  initializeFaceRecognition,
  isFaceRecognitionReady,
  getEmbedding,
  findMatch,
  disposeFaceRecognition,
} from '@/services/faceRecognition'
import { getAllEmbeddings } from '@/store/faceStore'
import { detectFaces, isFaceDetectorReady } from '@/services/faceDetection'
import type { FaceMatch } from '@/types/index.d.ts'
import type { EnrolledFace } from '@/services/faceRecognition'
import { FACE_RECOGNITION } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────

export interface UseFaceRecognitionOptions {
  /** The video element to recognise faces from */
  videoElement: HTMLVideoElement | null
  /** Whether recognition should be running */
  enabled: boolean
}

export interface UseFaceRecognitionReturn {
  /** Best match from the current frame, or null if none / unknown */
  match: FaceMatch | null
  /** Whether the MobileFaceNet model is loaded and ready */
  isModelLoaded: boolean
  /** Whether the model is currently being initialised */
  isLoading: boolean
  /** Error message if initialisation failed */
  error: string | null
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Extracts a rectangular region from a video frame as ImageData.
 * Returns null on failure (e.g. canvas context unavailable).
 */
function extractFaceCrop(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
): ImageData | null {
  try {
    const canvas = document.createElement('canvas')
    const w = Math.max(1, Math.round(box.width))
    const h = Math.max(1, Math.round(box.height))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } catch {
    return null
  }
}

// ── Hook ──────────────────────────────────────────────────────────

export function useFaceRecognition({
  videoElement,
  enabled,
}: UseFaceRecognitionOptions): UseFaceRecognitionReturn {
  const [match, setMatch] = useState<FaceMatch | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rafIdRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  // ── Initialise Recognition model on mount ─────────────────────────
  useEffect(() => {
    let cancelled = false

    if (isFaceRecognitionReady()) {
      setIsModelLoaded(true)
      setIsLoading(false)
      return
    }

    async function init(): Promise<void> {
      setIsLoading(true)
      try {
        const success = await initializeFaceRecognition()
        if (cancelled) return
        if (success) {
          setIsModelLoaded(true)
          setError(null)
        } else {
          setError('Failed to load face recognition model')
        }
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialise face recognition',
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

  // ── Recognition loop (~1 fps) ────────────────────────────────────
  useEffect(() => {
    if (!enabled || !videoElement || !isModelLoaded) {
      setMatch(null)
      return
    }

    const INTERVAL_MS = 1000
    const video: HTMLVideoElement = videoElement

    async function processFrame(): Promise<void> {
      if (
        video.paused ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return
      }

      try {
        // 1. Collect face regions from the current frame
        const regions: Array<{
          x: number
          y: number
          width: number
          height: number
        }> = []

        if (isFaceDetectorReady()) {
          const detectionResult = detectFaces(video)
          for (const det of detectionResult.detections) {
            regions.push(det.boundingBox)
          }
        }

        // 2. Bail early if nothing to work with
        const raw = await getAllEmbeddings()
        if (regions.length === 0 || raw.length === 0) {
          setMatch(null)
          return
        }

        // Map to EnrolledFace (findMatch requires createdAt / thumbnailUrl)
        const enrolled: EnrolledFace[] = raw.map((e) => ({
          id: e.id,
          name: e.name,
          embedding: e.embedding,
          createdAt: 0,
          thumbnailUrl: undefined,
        }))

        // 3. Process each region and keep the best match
        let bestMatch: FaceMatch | null = null

        for (const box of regions) {
          const crop = extractFaceCrop(video, box)
          if (!crop) continue

          const embedding = await getEmbedding(crop)
          if (!embedding) continue

          const result = findMatch(
            embedding,
            enrolled,
            FACE_RECOGNITION.SIMILARITY_THRESHOLD,
          )
          if (
            result.match &&
            (!bestMatch || result.score > bestMatch.confidence)
          ) {
            bestMatch = {
              personId: result.match.id,
              personName: result.match.name,
              confidence: result.score,
            }
          }
        }

        setMatch(bestMatch)
      } catch {
        // Silently ignore frame-level errors
      }
    }

    function loop(timestamp: number): void {
      if (timestamp - lastFrameTimeRef.current >= INTERVAL_MS) {
        lastFrameTimeRef.current = timestamp
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        processFrame()
      }
      rafIdRef.current = requestAnimationFrame(loop)
    }

    lastFrameTimeRef.current = 0
    rafIdRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
    }
  }, [enabled, videoElement, isModelLoaded])

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      disposeFaceRecognition()
    }
  }, [])

  return { match, isModelLoaded, isLoading, error }
}
