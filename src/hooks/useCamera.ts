import { useState, useEffect, useCallback, useRef } from 'react'
import { cameraService } from '@/services/camera'
import type { CameraConfig } from '@/services/camera'

/** Return type for the useCamera hook */
export interface UseCameraResult {
  /** The active media stream, or null if not active */
  stream: MediaStream | null
  /** Whether the camera is currently being initialized or switched */
  isLoading: boolean
  /** User-friendly error message, or null */
  error: string | null
  /** Current facing mode of the active camera */
  facingMode: 'user' | 'environment'
  /** List of available video input devices */
  cameras: MediaDeviceInfo[]
  /** Start the camera with optional config */
  startCamera: (config?: Partial<CameraConfig>) => Promise<void>
  /** Stop the camera and release the stream */
  stopCamera: () => void
  /** Switch between front and back cameras */
  switchCamera: () => Promise<void>
  /** True if the last error was a permission denial */
  permissionDenied: boolean
  /** Retry starting the camera with the last config */
  retry: () => Promise<void>
}

/**
 * React hook that manages camera access.
 * Automatically starts the camera on mount and cleans up on unmount.
 */
export function useCamera(): UseCameraResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const lastConfigRef = useRef<Partial<CameraConfig> | undefined>(undefined)
  const mountedRef = useRef(true)

  const startCamera = useCallback(async (config?: Partial<CameraConfig>) => {
    if (!mountedRef.current) return

    setIsLoading(true)
    setError(null)
    setPermissionDenied(false)
    lastConfigRef.current = config

    try {
      const s = await cameraService.getStream(config)

      if (!mountedRef.current) {
        // Component unmounted while we were waiting — clean up
        cameraService.stopStream(s)
        return
      }

      // Stop any old stream before setting the new one
      if (streamRef.current) {
        cameraService.stopStream(streamRef.current)
      }

      streamRef.current = s
      setStream(s)
      setFacingMode(config?.facingMode ?? 'user')

      // Re-enumerate now that permission is granted (labels will be populated)
      const devices = await cameraService.getCameras()
      if (mountedRef.current) {
        setCameras(devices)
      }
    } catch (err) {
      if (!mountedRef.current) return

      const message = cameraService.getErrorMessage(err)
      setError(message)
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionDenied(true)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      cameraService.stopStream(streamRef.current)
      streamRef.current = null
      setStream(null)
    }
  }, [])

  const switchCamera = useCallback(async () => {
    if (!streamRef.current) return
    setIsLoading(true)
    setError(null)

    const oldStream = streamRef.current

    try {
      const result = await cameraService.switchCamera(facingMode)

      if (!mountedRef.current) {
        cameraService.stopStream(result.stream)
        return
      }

      // Stop old stream AFTER new one is acquired for seamless transition
      cameraService.stopStream(oldStream)

      streamRef.current = result.stream
      setStream(result.stream)
      setFacingMode(result.facingMode)
    } catch (err) {
      if (!mountedRef.current) return
      const message = cameraService.getErrorMessage(err)
      setError(message)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [facingMode])

  const retry = useCallback(async () => {
    await startCamera(lastConfigRef.current)
  }, [startCamera])

  // Track mount state to avoid state updates after unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Start camera on mount, stop on unmount
  useEffect(() => {
    startCamera()

    return () => {
      if (streamRef.current) {
        cameraService.stopStream(streamRef.current)
        streamRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    stream,
    isLoading,
    error,
    facingMode,
    cameras,
    startCamera,
    stopCamera,
    switchCamera,
    permissionDenied,
    retry,
  }
}
