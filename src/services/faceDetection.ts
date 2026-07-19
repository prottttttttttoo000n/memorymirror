/**
 * Face detection service using MediaPipe Tasks Vision (BlazeFace).
 * Provides singleton initialization, detection, and cleanup.
 *
 * Model: BlazeFace short range (optimized for near-field faces)
 * Keypoints: right eye, left eye, nose tip, mouth center, right ear, left ear
 */

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import type { FaceDetectionResult, DetectedFace } from '@/types/index.d.ts'
import { FACE_DETECTION } from '@/lib/constants'

// ── Module-level state (singleton) ────────────────────────────────

let faceDetector: FaceDetector | null = null
let isInitialized = false
let initPromise: Promise<boolean> | null = null

// ── Public API ────────────────────────────────────────────────────

/**
 * Initializes the MediaPipe FaceDetector (WASM runtime + model).
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initializeFaceDetector(): Promise<boolean> {
  if (isInitialized) return true
  if (initPromise) return initPromise

  initPromise = (async (): Promise<boolean> => {
    try {
      const wasmFileset = await FilesetResolver.forVisionTasks(
        FACE_DETECTION.WASM_CDN
      )
      faceDetector = await FaceDetector.createFromModelPath(
        wasmFileset,
        FACE_DETECTION.MODEL_URL
      )
      await faceDetector.setOptions({
        minDetectionConfidence: FACE_DETECTION.MIN_CONFIDENCE,
      })
      isInitialized = true
      return true
    } catch (err) {
      console.error('[FaceDetection] Failed to initialize:', err)
      isInitialized = false
      faceDetector = null
      return false
    }
  })()

  return initPromise
}

/** Returns whether the FaceDetector is loaded and ready. */
export function isFaceDetectorReady(): boolean {
  return isInitialized && faceDetector !== null
}

/**
 * Runs face detection on the given video element.
 * Returns an empty result if the model isn't ready or detection fails.
 */
export function detectFaces(
  videoElement: HTMLVideoElement
): FaceDetectionResult {
  if (
    !isInitialized ||
    !faceDetector ||
    !videoElement ||
    videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return { detections: [], timestamp: Date.now() }
  }

  try {
    const result = faceDetector.detect(videoElement)

    if (!result || !result.detections || result.detections.length === 0) {
      return { detections: [], timestamp: Date.now() }
    }

    const detections: DetectedFace[] = result.detections.map((detection, index) => {
      const bb = detection.boundingBox
      const keypoints = (detection.keypoints || []).map((kp) => ({
        x: kp.x,
        y: kp.y,
        name: kp.label,
      }))

      return {
        id: index,
        boundingBox: {
          x: bb?.originX ?? 0,
          y: bb?.originY ?? 0,
          width: bb?.width ?? 0,
          height: bb?.height ?? 0,
        },
        keypoints,
        score: detection.categories?.[0]?.score ?? 0,
      }
    })

    return { detections, timestamp: Date.now() }
  } catch (err) {
    console.error('[FaceDetection] Detection error:', err)
    return { detections: [], timestamp: Date.now() }
  }
}

/**
 * Releases FaceDetector resources (WebGL / WASM memory).
 * Call when face detection is no longer needed.
 */
export function disposeFaceDetector(): void {
  if (faceDetector) {
    faceDetector.close()
    faceDetector = null
  }
  isInitialized = false
  initPromise = null
}
