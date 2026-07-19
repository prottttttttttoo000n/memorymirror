/**
 * Face enrollment pipeline — processes detected faces, decides whether
 * they match a known person or are a new face to enroll.
 *
 * The flow for a single detection:
 *   1. Debounce check (5 s between triggers)
 *   2. Size / confidence gate
 *   3. Crop the face region from the video
 *   4. Compute a 128-d embedding via getEmbedding()
 *   5. Compare against all enrolled faces via findMatch()
 *   6. Known → return recognised action; unknown → return candidate
 *
 * Callers (typically ARViewPage) subscribe via processDetection() and
 * drive the UI from the returned EnrollmentAction.
 */

import type { DetectedFace } from '@/types/index.d.ts'
import { getEmbedding, findMatch } from '@/services/faceRecognition'
import type { EnrolledFace } from '@/services/faceRecognition'
import { getAllEmbeddings, saveFace } from '@/store/faceStore'
import { FACE_RECOGNITION } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────

export interface EnrollmentCandidate {
  /** JPEG data URL of the face crop (112×112) */
  thumbnail: string
  /** Timestamp when the candidate was created */
  timestamp: number
  /** Bounding box of the detected face (video-pixel coords) */
  boundingBox: { x: number; y: number; width: number; height: number }
  /** Detection confidence score */
  score: number
}

export type EnrollmentAction =
  | { type: 'recognized'; person: { id: string; name: string; confidence: number } }
  | { type: 'unknown'; candidate: EnrollmentCandidate }
  | { type: 'none' }

// ── Module-level state (debounce + pending candidate) ────────────

let lastEnrollmentTrigger = 0
let pendingCandidate: EnrollmentCandidate | null = null
let pendingEmbedding: Float32Array | null = null

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Extracts a rectangular region from a video frame and returns it as
 * raw ImageData (suitable for getEmbedding).
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

/**
 * Crops a face region and returns a thumbnail JPEG data URL (112×112).
 */
function cropToDataURL(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 112
    canvas.height = 112
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, 112, 112)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Process a single detected face: figure out whether it is a known
 * person or a new candidate for enrollment.
 *
 * @param face          - A detected face from MediaPipe
 * @param videoElement  - The live video element (for cropping)
 * @returns An EnrollmentAction describing what to do next
 */
export async function processDetection(
  face: DetectedFace,
  videoElement: HTMLVideoElement,
): Promise<EnrollmentAction> {
  const now = Date.now()

  // 1. Debounce — prevent flooding from rapid detections
  if (now - lastEnrollmentTrigger < FACE_RECOGNITION.ENROLL_DEBOUNCE_MS) {
    return { type: 'none' }
  }

  // 2. Quality gates — skip small / low-confidence faces
  if (face.boundingBox.width < FACE_RECOGNITION.ENROLL_MIN_FACE_WIDTH) {
    return { type: 'none' }
  }
  if (face.score < FACE_RECOGNITION.ENROLL_MIN_CONFIDENCE) {
    return { type: 'none' }
  }

  // 3. Crop the face region from the live video
  const crop = extractFaceCrop(videoElement, face.boundingBox)
  if (!crop) return { type: 'none' }

  // 4. Compute the 128-d embedding
  const embedding = await getEmbedding(crop)
  if (!embedding) return { type: 'none' }

  // 5. Compare against all enrolled faces
  const raw = await getAllEmbeddings()
  const enrolled: EnrolledFace[] = raw.map((e) => ({
    id: e.id,
    name: e.name,
    embedding: e.embedding,
    createdAt: 0,
    thumbnailUrl: undefined,
  }))
  const result = findMatch(embedding, enrolled, FACE_RECOGNITION.SIMILARITY_THRESHOLD)

  // 6. Known person → recognised
  if (result.match) {
    lastEnrollmentTrigger = now
    return {
      type: 'recognized',
      person: {
        id: result.match.id,
        name: result.match.name,
        confidence: result.score,
      },
    }
  }

  // 7. Unknown face → generate enrolment candidate
  const thumbnail = cropToDataURL(videoElement, face.boundingBox)
  if (!thumbnail) return { type: 'none' }

  lastEnrollmentTrigger = now
  pendingEmbedding = embedding

  const candidate: EnrollmentCandidate = {
    thumbnail,
    timestamp: now,
    boundingBox: { ...face.boundingBox },
    score: face.score,
  }
  pendingCandidate = candidate

  return { type: 'unknown', candidate }
}

/**
 * Confirm enrolment of the pending candidate with a human-readable name.
 * Persists the face to IndexedDB and clears the pending state.
 *
 * @param name - The person's name to store
 * @returns The newly created face record ID
 * @throws If there is no pending candidate
 */
export async function confirmEnrollment(name: string): Promise<string> {
  if (!pendingCandidate || !pendingEmbedding) {
    throw new Error('No pending enrollment candidate')
  }

  const id = await saveFace({
    name,
    embedding: Array.from(pendingEmbedding),
    thumbnail: pendingCandidate.thumbnail,
  })

  pendingCandidate = null
  pendingEmbedding = null
  return id
}

/**
 * Dismiss the pending enrolment candidate without saving.
 */
export function dismissEnrollment(): void {
  pendingCandidate = null
  pendingEmbedding = null
}

/**
 * Returns the current pending candidate, or null if none.
 */
export function getPendingCandidate(): EnrollmentCandidate | null {
  return pendingCandidate
}
