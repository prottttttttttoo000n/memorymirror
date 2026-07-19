/**
 * Camera service for accessing device camera.
 * Handles camera initialization, switching, and cleanup.
 */

import { DEFAULT_CAMERA_CONFIG, CAMERA_ERROR_MESSAGES } from '@/lib/constants'
import { ENV } from '@/lib/env'

/** Configuration for camera stream constraints */
export interface CameraConfig {
  facingMode: 'user' | 'environment'
  resolution: { width: number; height: number }
  frameRate: { ideal: number; min?: number }
}

/** Camera service interface */
export interface CameraService {
  /** Get media stream from device camera */
  getStream(config?: Partial<CameraConfig>): Promise<MediaStream>

  /** Switch between front/back cameras */
  switchCamera(currentFacingMode: 'user' | 'environment'): Promise<{
    stream: MediaStream
    facingMode: 'user' | 'environment'
  }>

  /** Stop all tracks in a stream */
  stopStream(stream: MediaStream): void

  /** Check if camera is available on this device */
  isCameraAvailable(): Promise<boolean>

  /** Enumerate available video devices */
  getCameras(): Promise<MediaDeviceInfo[]>

  /** Get optimal resolution for current device */
  getOptimalResolution(): { width: number; height: number }

  /** Map a thrown error to a user-friendly message */
  getErrorMessage(error: unknown): string
}

/**
 * Build MediaStreamConstraints from a partial CameraConfig.
 * Uses defaults for any omitted fields.
 */
function buildConstraints(config: Partial<CameraConfig>): MediaStreamConstraints {
  const merged: CameraConfig = {
    facingMode: config.facingMode ?? DEFAULT_CAMERA_CONFIG.facingMode,
    resolution: config.resolution ?? DEFAULT_CAMERA_CONFIG.resolution,
    frameRate: config.frameRate ?? DEFAULT_CAMERA_CONFIG.frameRate,
  }

  const videoConstraints: MediaTrackConstraints = {
    facingMode: merged.facingMode,
    width: { ideal: merged.resolution.width },
    height: { ideal: merged.resolution.height },
    frameRate: { ideal: merged.frameRate.ideal },
  }

  if (merged.frameRate.min !== undefined) {
    videoConstraints.frameRate = {
      ideal: merged.frameRate.ideal,
      min: merged.frameRate.min,
    }
  }

  return {
    video: videoConstraints,
    audio: false,
  }
}

/** Create a NotSupportedError - needed because DOMException constructor with name isn't universally supported */
function createCameraError(message: string, name: string): DOMException {
  try {
    return new DOMException(message, name)
  } catch {
    // Fallback for environments that don't support DOMException with cause
    const err = new Error(message) as Error & { name: string; code: number }
    err.name = name
    return err as unknown as DOMException
  }
}

export const cameraService: CameraService = {
  async getStream(config?: Partial<CameraConfig>): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw createCameraError(
        'Camera access is not available. Make sure you\'re on a secure connection (HTTPS or localhost).',
        'NotSupportedError'
      )
    }

    // If user hasn't interacted yet, iOS Safari may throw without a user gesture.
    // We let the error propagate naturally — the hook catches and displays it.
    try {
      const envConfig: Partial<CameraConfig> = {}
      const envRes = ENV.CAMERA_RESOLUTION
      if (envRes === '720p') envConfig.resolution = { width: 1280, height: 720 }
      else if (envRes === '1080p') envConfig.resolution = { width: 1920, height: 1080 }

      const envFacing = ENV.CAMERA_FACING_MODE
      if (envFacing !== DEFAULT_CAMERA_CONFIG.facingMode) {
        envConfig.facingMode = envFacing
      }

      const minFps = ENV.CAMERA_MIN_FPS
      if (minFps > 0) {
        envConfig.frameRate = { ideal: 30, min: minFps }
      }

      const mergedConfig = { ...envConfig, ...config }
      const constraints = buildConstraints(mergedConfig)
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      // Re-throw DOMExceptions as-is so the caller can inspect the name
      if (err instanceof DOMException) {
        throw err
      }
      throw createCameraError(
        'An unexpected error occurred while accessing the camera.',
        'AbortError'
      )
    }
  },

  async switchCamera(
    currentFacingMode: 'user' | 'environment'
  ): Promise<{ stream: MediaStream; facingMode: 'user' | 'environment' }> {
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'
    const stream = await this.getStream({ facingMode: newFacingMode })
    return { stream, facingMode: newFacingMode }
  },

  stopStream(stream: MediaStream): void {
    if (!stream) return
    for (const track of stream.getTracks()) {
      track.stop()
    }
  },

  async isCameraAvailable(): Promise<boolean> {
    if (!navigator.mediaDevices?.enumerateDevices) return false
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((d) => d.kind === 'videoinput')
    } catch {
      return false
    }
  },

  async getCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'videoinput')
    } catch {
      return []
    }
  },

  getOptimalResolution(): { width: number; height: number } {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile) {
      return { width: 1280, height: 720 }
    }
    if (window.screen.width >= 1920 || window.screen.height >= 1080) {
      return { width: 1920, height: 1080 }
    }
    return { width: 1280, height: 720 }
  },

  getErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      return CAMERA_ERROR_MESSAGES[error.name] ?? `Camera error: ${error.message}`
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown camera error occurred.'
  },
}
