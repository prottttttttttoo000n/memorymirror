/**
 * Face recognition service using MobileFaceNet via ONNX Runtime Web.
 *
 * Loads a quantized MobileFaceNet ONNX model, computes 128-dimensional
 * face embeddings from face crops, and compares embeddings using cosine
 * similarity.
 *
 * The model is loaded lazily on first use and cached for subsequent calls.
 * Falls back gracefully (isInitialized = false) if the model fails to load.
 */

import * as ort from 'onnxruntime-web'
import { FACE_RECOGNITION } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────

/** A face enrolled for recognition (loaded from IndexedDB). */
export interface EnrolledFace {
  id: string
  name: string
  /** 128-dimensional embedding as Float32Array */
  embedding: Float32Array
  createdAt: number
  thumbnailUrl?: string
}

/** Result of a face recognition lookup. */
export interface FaceMatch {
  personId: string
  personName: string
  confidence: number
}

// ── Module-level state (singleton) ────────────────────────────────

let session: ort.InferenceSession | null = null
let initialized = false
let initPromise: Promise<boolean> | null = null
let modelInputName = ''
let modelOutputName = ''

// ── Constants ─────────────────────────────────────────────────────

const INPUT_SIZE = 112
const MAX_RETRIES = 2

// ── Public API ────────────────────────────────────────────────────

/**
 * Initializes the ONNX Runtime session and loads the MobileFaceNet model.
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initializeFaceRecognition(): Promise<boolean> {
  if (initialized) return true
  if (initPromise) return initPromise

  // Timeout wrapper to prevent indefinite hangs (e.g. when WASM can't load)
  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
      ),
    ])

  initPromise = (async (): Promise<boolean> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Configure ONNX Runtime WebAssembly backend
        ort.env.wasm.wasmPaths = FACE_RECOGNITION.WASM_CDN
        // Force single-threaded mode (avoids SharedArrayBuffer requirement)
        ort.env.wasm.numThreads = 1
        // Disable proxy worker to simplify WASM loading
        ort.env.wasm.proxy = false

        const modelPath = FACE_RECOGNITION.MODEL_PATH
        session = await withTimeout(
          ort.InferenceSession.create(modelPath, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
          }),
          30000,
          'Model load',
        )

        // Discover input/output names from the model
        const inputNames = session.inputNames
        const outputNames = session.outputNames

        if (inputNames.length === 0 || outputNames.length === 0) {
          throw new Error('Model has no inputs or outputs')
        }

        modelInputName = inputNames[0]
        modelOutputName = outputNames[0]

        initialized = true
        console.log('[FaceRecognition] Model loaded:', modelPath)
        console.log('[FaceRecognition] Input:', modelInputName, 'Output:', modelOutputName)
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[FaceRecognition] Load attempt ${attempt}/${MAX_RETRIES} failed:`, msg)
        console.error('[FaceRecognition] Env:', {
          wasmPaths: ort.env.wasm.wasmPaths,
          numThreads: ort.env.wasm.numThreads,
          proxy: ort.env.wasm.proxy,
          simd: ort.env.wasm.simd,
          hasSAB: typeof SharedArrayBuffer !== 'undefined',
        })
        if (attempt < MAX_RETRIES) {
          // Brief delay before retry
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }

    // All attempts exhausted
    initialized = false
    session = null
    return false
  })()

  return initPromise
}

/** Returns whether the recognition model is loaded and ready. */
export function isFaceRecognitionReady(): boolean {
  return initialized && session !== null
}

/**
 * Computes a 128-dimensional face embedding from an ImageData crop.
 *
 * Steps:
 * 1. Resize the crop to 112×112 via offscreen canvas
 * 2. Convert to float32 tensor [1, 3, 112, 112] (NCHW)
 * 3. Normalize: pixel = (pixel / 255 - 0.5) / 0.5
 * 4. Run ONNX inference
 *
 * @param imageData - ImageData from a canvas containing a face crop
 * @returns 128-element Float32Array embedding, or null on failure
 */
export async function getEmbedding(
  imageData: ImageData
): Promise<Float32Array | null> {
  if (!initialized || !session) {
    console.warn('[FaceRecognition] Not initialized')
    return null
  }

  try {
    // 1. Resize to 112×112 via offscreen canvas
    const tensor = preprocessImage(imageData)

    // 2. Run inference
    const feeds: Record<string, ort.Tensor> = {
      [modelInputName]: tensor,
    }

    const results = await session.run(feeds)
    const outputTensor = results[modelOutputName]

    if (!outputTensor || !(outputTensor.data instanceof Float32Array)) {
      console.error('[FaceRecognition] Unexpected output format')
      return null
    }

    // 3. Normalize embedding to unit length for reliable cosine similarity
    const raw = outputTensor.data as Float32Array
    const embedding = l2Normalize(raw)

    return embedding
  } catch (err) {
    console.error('[FaceRecognition] Inference error:', err)
    return null
  }
}

/**
 * Computes cosine similarity between two embeddings.
 *
 * Cosine similarity = dot(a, b) / (||a|| * ||b||)
 * Range: [-1, 1], where 1 = identical direction.
 */
export function compareEmbeddings(
  a: Float32Array,
  b: Float32Array
): number {
  if (a.length !== b.length) {
    console.warn('[FaceRecognition] Embedding dimension mismatch:', a.length, b.length)
    return -1
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Finds the best matching enrolled face for a given embedding.
 *
 * @param embedding - The query embedding to match
 * @param enrolled - Array of enrolled faces with embeddings
 * @param threshold - Minimum similarity threshold (default: 0.6)
 * @returns The best match with score, or { match: null, score: 0 } if none above threshold
 */
export function findMatch(
  embedding: Float32Array,
  enrolled: EnrolledFace[],
  threshold: number = FACE_RECOGNITION.SIMILARITY_THRESHOLD
): { match: EnrolledFace | null; score: number } {
  if (enrolled.length === 0) {
    return { match: null, score: 0 }
  }

  let bestScore = -1
  let bestMatch: EnrolledFace | null = null

  for (const face of enrolled) {
    const score = compareEmbeddings(embedding, face.embedding)
    if (score > bestScore) {
      bestScore = score
      bestMatch = face
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { match: bestMatch, score: bestScore }
  }

  return { match: null, score: bestScore }
}

/**
 * Releases the ONNX InferenceSession and resets state.
 * Call when recognition is no longer needed.
 */
export function disposeFaceRecognition(): void {
  if (session) {
    // InferenceSession doesn't have a close() in onnxruntime-web,
    // but we release our reference for GC
    session = null
  }
  initialized = false
  initPromise = null
  modelInputName = ''
  modelOutputName = ''
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Preprocesses an ImageData crop into a normalized NCHW float32 tensor
 * suitable for MobileFaceNet.
 */
function preprocessImage(imageData: ImageData): ort.Tensor {
  // putImageData does NOT scale — we must draw the source onto a temp canvas
  // then use drawImage (which DOES scale) to resize to the model's 112×112 input.
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = imageData.width
  tempCanvas.height = imageData.height
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(imageData, 0, 0)

  // Now draw (with bilinear scaling) onto the target 112×112 canvas
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(tempCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE)

  // Read the resized pixel data
  const resized = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const pixels = resized.data

  // Build NCHW float32 tensor [1, 3, H, W]
  // Normalize: (pixel / 255 - 0.5) / 0.5 = pixel / 127.5 - 1
  const floatLen = 1 * 3 * INPUT_SIZE * INPUT_SIZE
  const floatData = new Float32Array(floatLen)

  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      const pixelIndex = (y * INPUT_SIZE + x) * 4
      const r = pixels[pixelIndex] / 255
      const g = pixels[pixelIndex + 1] / 255
      const b = pixels[pixelIndex + 2] / 255

      // NCHW layout: channel-first
      // Channel 0 (R)
      floatData[0 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (r - 0.5) / 0.5
      // Channel 1 (G)
      floatData[1 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (g - 0.5) / 0.5
      // Channel 2 (B)
      floatData[2 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (b - 0.5) / 0.5
    }
  }

  return new ort.Tensor('float32', floatData, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

/**
 * L2-normalizes a Float32Array in-place and returns it.
 * Unit-length embeddings ensure cosine similarity is equivalent to dot product.
 */
function l2Normalize(vec: Float32Array): Float32Array {
  let sumSq = 0
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i]
  }

  const norm = Math.sqrt(sumSq)
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm
    }
  }

  return vec
}
