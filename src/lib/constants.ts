export const APP_NAME = 'MemoryMirror'
declare const __APP_VERSION__: string
export const APP_VERSION = __APP_VERSION__

export const DB_NAME = 'memorymirror-db'
export const DB_VERSION = 1

export const STORE_NAMES = {
  MEMORIES: 'memories',
  PEOPLE: 'people',
  SETTINGS: 'settings',
  CONVERSATIONS: 'conversations',
  FACES: 'faces',
} as const

export const NAV_TABS = [
  { id: 'ar-view' as const, label: 'AR View', icon: 'camera' },
  { id: 'timeline' as const, label: 'Timeline', icon: 'list' },
  { id: 'people' as const, label: 'People', icon: 'person' },
  { id: 'settings' as const, label: 'Settings', icon: 'gear' },
] as const

export const DEFAULT_SETTINGS = {
  language: 'en',
  enableAR: true,
  enableSpeech: true,
  enableAutoCapture: false,
  recognitionThreshold: 0.7,
  theme: 'dark' as const,
  fontSize: 'normal' as const,
}

export const TOUCH_TARGET_MIN = 44

/** Default camera configuration for the AR view */
export const DEFAULT_CAMERA_CONFIG = {
  facingMode: 'user' as const,
  resolution: { width: 1280, height: 720 },
  frameRate: { ideal: 15 },
}

/** User-friendly error messages for DOMException camera errors */
export const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Camera permission denied. Please allow camera access in your browser settings.',
  NotFoundError: 'No camera found on this device.',
  NotReadableError: 'Camera is in use by another application.',
  AbortError: 'Camera access was aborted.',
  OverconstrainedError: "Camera doesn't support the requested resolution.",
  SecurityError: 'Camera access is blocked. Access the page via HTTPS or localhost.',
  NotSupportedError: 'Camera is not supported on this device or browser.',
}

/** Common video resolutions supported by most cameras */
export const SUPPORTED_RESOLUTIONS = [
  { label: 'Full HD (1080p)', width: 1920, height: 1080 },
  { label: 'HD (720p)', width: 1280, height: 720 },
  { label: 'VGA (640x480)', width: 640, height: 480 },
  { label: 'QVGA (320x240)', width: 320, height: 240 },
] as const

/** Face detection model and runtime configuration */
export const FACE_DETECTION = {
  MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  WASM_CDN: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
  MIN_CONFIDENCE: 0.5,
  TARGET_FPS: 15,
  INTERVAL_MS: 66,
} as const

/**
 * Face recognition (MobileFaceNet via ONNX Runtime Web) configuration.
 * Model path is configurable via VITE_FACE_MODEL_PATH env var.
 */
export const FACE_RECOGNITION = {
  /** URL or path to the MobileFaceNet ONNX model.
   * Historical note: the old opencv_zoo GitHub raw URL (mobilefacenet/mobilefacenet.onnx)
   * was moved when opencv_zoo migrated to Hugging Face. The model below is the official
   * replacement: SFace (MobileFaceNet backbone, 128-dim embeddings).
   * We use the int8-quantized version (~10 MB vs ~39 MB float) for faster downloads.
   * Fallback provided for custom model via VITE_FACE_MODEL_PATH env. */
  MODEL_PATH: import.meta.env.VITE_FACE_MODEL_PATH as string | undefined ?? 'https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec_int8.onnx',
  /** Input tensor shape expected by the model */
  INPUT_SHAPE: [1, 3, 112, 112] as const,
  /** Minimum cosine similarity to consider a face match */
  SIMILARITY_THRESHOLD: 0.6,
  /** Minimum detection confidence to queue a face for enrollment */
  ENROLL_MIN_CONFIDENCE: 0.8,
  /** Debounce interval between enrollment triggers (ms) */
  ENROLL_DEBOUNCE_MS: 5000,
  /** Minimum face width (pixels) to consider for enrollment */
  ENROLL_MIN_FACE_WIDTH: 100,
  /** CDN path for ONNX Runtime WebAssembly backend files */
  WASM_CDN: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/',
} as const

/** LLM configuration for Workers AI Llama 3.1 8B extraction */
export const LLM = {
  /** Model used on the server (configurable via Pages Function env var) */
  MODEL: 'llama-3.1-8b-instant',
  TEMPERATURE: 0.3,
  MAX_TOKENS: 512,
  /** Workers AI free tier rate limit: 300 req/min */
  RATE_LIMIT_RPM: 300,
  /** 10k neurons/day is roughly ~1300 extractions; this is a conservative daily cap */
  DAILY_LIMIT_RPD: 1300,
} as const

/** Speech-to-text configuration for Workers AI Whisper and recording */
export const STT = {
  /** Model used on the server (configurable via Pages Function env var) */
  MODEL: 'whisper-large-v3-turbo',
  TEMPERATURE: 0.1,
  LANGUAGE: 'en',
  MAX_RECORDING_DURATION_MS: 5 * 60 * 1000,
  AUDIO_MIME_TYPE: 'audio/webm',
  SAMPLE_RATE: 16000,
} as const
