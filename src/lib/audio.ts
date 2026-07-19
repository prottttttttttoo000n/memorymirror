/**
 * Audio utility functions for speech capture and playback.
 * Full implementation in Phase 2.
 */

export function isAudioSupported(): boolean {
  return !!(navigator.mediaDevices?.getUserMedia)
}

export function getAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    },
  }
}

export function createAudioContext(): AudioContext | null {
  try {
    return new AudioContext()
  } catch {
    return null
  }
}
