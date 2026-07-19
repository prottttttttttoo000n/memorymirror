import type { ReactNode, JSX } from 'react'
import { FaceOverlay } from '@/components/FaceOverlay'
import type { FaceDetectionResult } from '@/types/index.d.ts'

export interface ARViewProps {
  children?: ReactNode
  /** Face detection result for the overlay */
  detectionResult?: FaceDetectionResult | null
  /** Intrinsic video width (videoWidth) */
  videoWidth?: number
  /** Intrinsic video height (videoHeight) */
  videoHeight?: number
  /** Mirror face overlay for front camera */
  mirrored?: boolean
  /** Current detection FPS for debug display */
  fps?: number
  /** Whether the face model is loaded */
  isModelLoaded?: boolean
  /** Show debug overlays (FPS counter, etc.) */
  showDebug?: boolean
  /**
   * Recognised person labels keyed by detection index.
   * Passed through to FaceOverlay for name rendering.
   */
  recognitions?: Map<number, { name: string; id: string; confidence: number }>
}

/**
 * AR view container that wraps camera preview and face overlay.
 * The inner Camera component handles video rendering;
 * FaceOverlay is drawn on top using a transparent canvas.
 */
export function ARView({
  children,
  detectionResult,
  videoWidth,
  videoHeight,
  mirrored = true,
  fps,
  isModelLoaded,
  showDebug = false,
  recognitions,
}: ARViewProps): JSX.Element {
  const hasVideo =
    videoWidth !== undefined &&
    videoHeight !== undefined &&
    videoWidth > 0 &&
    videoHeight > 0

  return (
    <div className="ar-view-container">
      {children}

      {hasVideo && detectionResult !== undefined && (
        <FaceOverlay
          result={detectionResult}
          videoWidth={videoWidth!}
          videoHeight={videoHeight!}
          mirrored={mirrored}
          recognitions={recognitions}
        />
      )}

      {/* Debug FPS counter */}
      {showDebug && fps !== undefined && fps > 0 && (
        <div className="detection-fps">Face: {fps} FPS</div>
      )}

      {/* Model loading indicator */}
      {isModelLoaded === false && (
        <div className="model-loading-indicator">Loading model...</div>
      )}
    </div>
  )
}
