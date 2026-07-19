/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
    abort(): void
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionResultList {
    length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionResult {
    isFinal: boolean
    length: number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    transcript: string
    confidence: number
  }

  interface SpeechRecognitionConstructor {
    new(): SpeechRecognition
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string
    message: string
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

/** A single memory entry stored in IndexedDB */
export interface MemoryEntry {
  id: string
  personId: string
  timestamp: number
  type: 'conversation' | 'observation' | 'photo' | 'note'
  title: string
  content: string
  mediaUrl?: string
  embedding?: Float32Array
  createdAt: number
  updatedAt: number
}

/** A recognized person stored in IndexedDB */
export interface Person {
  id: string
  name: string
  relationship: string
  faceDescriptor: Float32Array
  thumbnailUrl?: string
  lastSeen: number
  createdAt: number
  updatedAt: number
}

/** A conversation transcript segment */
export interface ConversationSegment {
  id: string
  personId: string
  timestamp: number
  speaker: 'user' | 'other'
  text: string
  translatedText?: string
}

/** Settings stored in IndexedDB */
export interface AppSettings {
  id: string
  language: string
  enableAR: boolean
  enableSpeech: boolean
  enableAutoCapture: boolean
  recognitionThreshold: number
  theme: 'dark' | 'light'
  fontSize: 'normal' | 'large' | 'x-large'
}

/** Face detection result from MediaPipe */
export interface FaceDetectionResult {
  detections: DetectedFace[]
  timestamp: number
}

/** A single face detected by MediaPipe BlazeFace */
export interface DetectedFace {
  /** Unique index for this detection in the current frame (0-based array index) */
  id?: number
  boundingBox: { x: number; y: number; width: number; height: number }
  keypoints: { x: number; y: number; name?: string }[]
  score: number
}

/** Face recognition match result */
export interface FaceMatch {
  personId: string
  personName: string
  confidence: number
}

/** Navigation tab definition */
export type TabId = 'ar-view' | 'timeline' | 'people' | 'settings'
