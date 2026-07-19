import { useRef, useEffect, type JSX } from 'react'
import type { FaceDetectionResult } from '@/types/index.d.ts'

// ── Props ─────────────────────────────────────────────────────────

export interface FaceOverlayProps {
  /** Latest face detection result */
  result: FaceDetectionResult | null
  /** Intrinsic width of the video element (videoWidth) */
  videoWidth: number
  /** Intrinsic height of the video element (videoHeight) */
  videoHeight: number
  /** Mirror the canvas horizontally (for front-facing camera) */
  mirrored?: boolean
  /**
   * Per-detection recognition data keyed by detection index.
   * When present, the bounding box + label switches to a green
   * "recognised" style and shows the person's name instead of
   * the raw confidence percentage.
   */
  recognitions?: Map<number, { name: string; id: string; confidence: number }>
}

// ── Drawing constants ─────────────────────────────────────────────

const BBOX_COLOR = '#00d4ff'
const RECOGNIZED_COLOR = '#2ed573'
const EYE_KEYPOINT_COLOR = '#ff00ff'
const KEYPOINT_COLOR = '#ffd700'
const KEYPOINT_RADIUS = 3
const BBOX_LINE_WIDTH = 2
const BBOX_ROUNDING = 4
const LABEL_FONT = '12px system-ui, -apple-system, sans-serif'
const LABEL_BG = 'rgba(0, 0, 0, 0.5)'

// BlazeFace short-range keypoint indices
const EYE_KEYPOINT_INDICES = new Set([0, 1])

// ── Component ─────────────────────────────────────────────────────

/**
 * Canvas overlay that draws face bounding boxes, landmarks, and
 * optional name tags on top of the camera video feed.
 *
 * When a recognition entry exists for a detection index the box
 * turns green and shows the person's name instead of the raw
 * confidence percentage.
 */
export function FaceOverlay({
  result,
  videoWidth,
  videoHeight,
  mirrored = false,
  recognitions,
}: FaceOverlayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayWidth = canvas.clientWidth
    const displayHeight = canvas.clientHeight

    if (
      displayWidth === 0 ||
      displayHeight === 0 ||
      videoWidth === 0 ||
      videoHeight === 0
    ) {
      return
    }

    // Set canvas resolution for retina / HiDPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    ctx.scale(dpr, dpr)

    // Clear the canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    if (!result || result.detections.length === 0) return

    // ── Video → display coordinate mapping ─────────────────────────
    // Simulate object-fit: cover so the overlay matches the video
    const videoAspect = videoWidth / videoHeight
    const containerAspect = displayWidth / displayHeight

    let scale: number
    let offsetX: number
    let offsetY: number

    if (videoAspect > containerAspect) {
      // Video is wider than container → crop left/right
      scale = displayHeight / videoHeight
      offsetX = (displayWidth - videoWidth * scale) / 2
      offsetY = 0
    } else {
      // Video is taller than container → crop top/bottom
      scale = displayWidth / videoWidth
      offsetX = 0
      offsetY = (displayHeight - videoHeight * scale) / 2
    }

    // Convert video-pixel coordinate to display coordinate
    const toDisplayX = (x: number): number => {
      const display = offsetX + x * scale
      return mirrored ? displayWidth - display : display
    }
    const toDisplayY = (y: number): number => offsetY + y * scale

    // ── Draw each detected face ────────────────────────────────────
    for (let i = 0; i < result.detections.length; i++) {
      const detection = result.detections[i]
      const bb = detection.boundingBox
      const recognition = recognitions?.get(i)

      // --- Bounding box ---
      const bbX = toDisplayX(bb.x)
      const bbY = toDisplayY(bb.y)
      const bbW = bb.width * scale
      const bbH = bb.height * scale

      // When mirrored, the bounding box origin flips
      const finalBbX = mirrored ? displayWidth - bbX - bbW : bbX

      // Pick colour based on recognition status
      const boxColor = recognition ? RECOGNIZED_COLOR : BBOX_COLOR
      ctx.strokeStyle = boxColor
      ctx.lineWidth = BBOX_LINE_WIDTH
      ctx.beginPath()

      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(finalBbX, bbY, bbW, bbH, BBOX_ROUNDING)
      } else {
        ctx.rect(finalBbX, bbY, bbW, bbH)
      }
      ctx.stroke()

      // --- Label above bounding box ---
      ctx.font = LABEL_FONT

      if (recognition) {
        // Recognised face — show green name pill
        const label = `${recognition.name} (${Math.round(recognition.confidence * 100)}%)`
        const textMetrics = ctx.measureText(label)
        const labelW = textMetrics.width + 8
        const labelH = 16
        const labelX = finalBbX - 1
        const labelY = bbY - labelH + 4

        ctx.fillStyle = LABEL_BG
        ctx.fillRect(labelX, labelY, labelW, labelH)

        ctx.fillStyle = RECOGNIZED_COLOR
        ctx.textBaseline = 'middle'
        ctx.fillText(label, labelX + 4, labelY + labelH / 2)
      } else {
        // Unknown face — show cyan confidence (existing behaviour)
        const label = `${Math.round(detection.score * 100)}%`
        const textMetrics = ctx.measureText(label)
        const labelW = textMetrics.width + 8
        const labelH = 16
        const labelX = finalBbX - 1
        const labelY = bbY - labelH + 4

        ctx.fillStyle = LABEL_BG
        ctx.fillRect(labelX, labelY, labelW, labelH)

        ctx.fillStyle = BBOX_COLOR
        ctx.textBaseline = 'middle'
        ctx.fillText(label, labelX + 4, labelY + labelH / 2)
      }

      // --- Keypoints (landmarks) ---
      for (let j = 0; j < detection.keypoints.length; j++) {
        const kp = detection.keypoints[j]
        // Keypoint x,y are normalized (0-1)
        const kpX = toDisplayX(kp.x * videoWidth)
        const kpY = toDisplayY(kp.y * videoHeight)

        // Eyes get magenta, all other landmarks get yellow
        ctx.fillStyle = EYE_KEYPOINT_INDICES.has(j)
          ? EYE_KEYPOINT_COLOR
          : KEYPOINT_COLOR

        ctx.beginPath()
        ctx.arc(kpX, kpY, KEYPOINT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [result, videoWidth, videoHeight, mirrored, recognitions])

  return (
    <canvas
      ref={canvasRef}
      className="face-overlay-canvas"
      aria-hidden="true"
    />
  )
}
