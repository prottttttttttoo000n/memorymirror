# MemoryMirror

AR-powered memory prosthetic for dementia patients. Uses the phone camera as a viewfinder to recognize faces, record conversations, and build a searchable memory timeline.

## Architecture

### Zero-Cost Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend | React 19 + Vite 8 + TypeScript 6 | $0 |
| PWA | vite-plugin-pwa + Workbox | $0 |
| Hosting | Cloudflare Pages (or any static host) | $0 |
| Face Detection | MediaPipe BlazeFace (client-side, WASM) | $0 |
| Face Recognition | MobileFaceNet via ONNX Runtime Web (client-side, WASM) | $0 |
| Speech-to-Text | Cloudflare Workers AI Whisper via Pages Function proxy (10k neurons/day) | $0 |
| LLM Extraction | Cloudflare Workers AI Llama 3.1 8B via Pages Function proxy (10k neurons/day) | $0 |
| Storage | IndexedDB (browser built-in) | $0 |
| HTTPS Tunnel | Cloudflare Quick Tunnel (for dev testing on mobile) | $0 |

### Data Flow

1. Camera stream opens via `getUserMedia()` → Frame sent to MediaPipe BlazeFace at ~15fps
2. Face detection returns bounding boxes + 6 facial landmarks (eyes, nose, mouth, ears)
3. Each detected face is cropped from the video frame and processed by MobileFaceNet (ONNX Runtime Web) to produce a 128-dim embedding
4. Embedding compared against enrolled faces via cosine similarity (threshold: 0.6)
5. Match found → green bounding box with name label; No match → enrollment notification shown after 5s debounce
6. User taps "Record Conversation" → microphone capture via MediaRecorder API (max 5 min)
7. Audio sent to our `/api/stt` proxy → Cloudflare Workers AI Whisper for STT; Web Speech API provides interim live preview
8. Transcript sent to our `/api/llm` proxy → Cloudflare Workers AI Llama 3.1 8B → structured extraction (summary, action items, person updates, key memories)
9. Extracted data saved to IndexedDB as MemoryEntry → displayed in timeline and person detail views

## Prerequisites

- Node.js 24+
- pnpm 10+
- Smartphone with camera (for testing camera features)
- Cloudflare account (free: https://dash.cloudflare.com/signup)
- Cloudflare Account ID and API Token with Workers AI permissions

## Setup

### 1. Clone and Install

```bash
pnpm install
```

### 2. Configure Cloudflare Credentials

**Option A — Environment file (dev only):**
```bash
echo "VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id" > .env
echo "VITE_CLOUDFLARE_API_TOKEN=your_api_token" >> .env
```

**Option B — Runtime (via Settings UI):**
Open the app → Settings → enter Account ID + API Token in the Cloudflare Credentials section. Stored in memory only.

### 3. Start Development

**Standard dev (no AI features — face detection/recognition work, STT/LLM degrade gracefully):**
```bash
pnpm dev
```

**Full-stack dev (with AI proxy):**
```bash
# Terminal 1: Vite dev server (HMR)
pnpm dev

# Terminal 2: Wrangler Pages dev (serves API proxy on port 8788)
pnpm dev:pages
```
Open http://localhost:8788 in your browser — the `/api/*` endpoints are served by `wrangler pages dev` which proxies static assets to Vite on 5173.

**Testing on mobile:**
```bash
pnpm dev
pnpm tunnel    # In another terminal — provides HTTPS URL
```

### Getting Cloudflare Credentials

1. Sign up at https://dash.cloudflare.com/signup (free, no credit card required)
2. Find your Account ID in the dashboard URL: `dash.cloudflare.com/<account-id>`
3. Create an API token:
   - Go to My Profile → API Tokens → Create Token
   - Use the "Workers AI" template or create custom with `workers-ai:run` permission
   - Copy the token (shown once)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_CLOUDFLARE_ACCOUNT_ID` | No* | — | Cloudflare Account ID for Workers AI |
| `VITE_CLOUDFLARE_API_TOKEN` | No* | — | Cloudflare API token with Workers AI permissions |
| `VITE_ENABLE_MOCK` | No | `false` | Enable mock services for development |
| `VITE_FACE_MODEL_PATH` | No | GitHub ONNX Zoo URL | Custom MobileFaceNet ONNX model URL |
| `VITE_CAMERA_RESOLUTION` | No | auto | Camera resolution target: `720p` or `1080p` |
| `VITE_CAMERA_FACING_MODE` | No | `user` | Preferred camera: `user` (front) or `environment` (back) |
| `VITE_CAMERA_MIN_FPS` | No | `15` | Minimum frame rate for camera stream |

*Required for STT and LLM extraction features. Without Cloudflare credentials, face detection/recognition still work, and Web Speech API provides basic STT.

## Development

```bash
pnpm dev         # Vite dev server (no AI proxy)
pnpm dev:pages   # Wrangler Pages dev + AI proxy (run alongside pnpm dev)
pnpm build       # TypeScript check + production build
pnpm lint        # Oxlint
pnpm tunnel      # Cloudflare tunnel for mobile HTTPS testing
pnpm preview     # Preview production build locally
```

### Testing on Mobile (Required for Camera/Mic)

```bash
pnpm dev
pnpm tunnel    # In another terminal — provides HTTPS URL
```

Open the tunnel URL on your phone. The app needs HTTPS for camera/mic access (HTTP works on localhost only).

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ARView.tsx        # AR overlay container + FPS counter
│   ├── Camera.tsx        # Video preview + loading/error/permission states
│   ├── ConversationView.tsx  # Recording UI + transcript bubbles
│   ├── FaceOverlay.tsx   # Canvas overlay for bounding boxes + landmarks
│   ├── MemoryTimeline.tsx    # Grouped timeline with skeleton loading
│   ├── PersonCard.tsx    # Person list item with avatar + metadata
│   └── SettingsPanel.tsx # Legacy placeholder (not used; see SettingsPage)
│
├── hooks/                # React hooks (state management + side effects)
│   ├── useCamera.ts      # Camera lifecycle (start/stop/switch/retry)
│   ├── useFaceDetection.ts   # MediaPipe BlazeFace ~15fps loop
│   ├── useFaceRecognition.ts # MobileFaceNet ONNX ~1fps recognition loop
│   ├── useLLM.ts     # LLM extraction with rate limiting
│   ├── useMemoryDB.ts    # Memory list loading (not directly used by pages)
│   └── useSpeechToText.ts    # Recording + API Whisper + Web Speech API
│
├── services/             # Business logic (no React dependency)
│   ├── camera.ts         # getUserMedia, switch camera, error mapping
│   ├── enrollment.ts     # Face enrollment pipeline (detect→embed→match→save)
│   ├── faceDetection.ts  # MediaPipe BlazeFace singleton (init→detect→dispose)
│   ├── faceRecognition.ts    # MobileFaceNet ONNX (init→embed→match→dispose)
│   ├── llmService.ts     # LLM extraction (calls /api/llm proxy)
│   ├── memoryDB.ts       # High-level memory/conversation queries
│   └── speechToText.ts   # AI Whisper STT (calls /api/stt proxy) + Web Speech API fallback
│
├── pages/                # Page-level components (routed by App.tsx)
│   ├── ARViewPage.tsx    # Camera + face detection + enrollment UI
│   ├── EnrollmentPage.tsx    # Legacy placeholder (enrollment done in ARView)
│   ├── PersonDetailPage.tsx  # Person profile + memories + conversation
│   ├── SettingsPage.tsx  # Settings with loading/error states
│   └── TimelinePage.tsx  # Memory timeline with refresh
│
├── store/                # IndexedDB data access layer
│   ├── db.ts             # Database singleton + schema (5 object stores)
│   ├── conversationStore.ts  # CRUD for conversation segments
│   ├── faceStore.ts      # CRUD for enrolled faces + people
│   ├── memoryStore.ts    # CRUD for memory entries
│   └── settingsStore.ts  # CRUD for app settings + storage usage
│
├── lib/                  # Utilities and configuration
│   ├── audio.ts          # Audio support detection + AudioContext creation
│   ├── canvas.ts         # OffscreenCanvas helpers
│   ├── constants.ts      # All config: DB, camera, face det/rec, LLM, STT
│   ├── env.ts            # Runtime env var access + API key override
│   └── types.ts          # Re-export barrel for type imports
│
├── types/
│   └── index.d.ts        # All TypeScript types + Web Speech API declarations
│
├── App.tsx               # Root component: tab navigation, routing, PWA updates
├── main.tsx              # Entry point (StrictMode wrapper)
└── index.css             # All CSS (component styles, animations, themes)
```

## Features

### 1. AR Face Detection

- Real-time face detection via MediaPipe BlazeFace (WASM, client-side)
- Bounding boxes with confidence scores (shown as percentage)
- 6 facial landmarks: right eye (magenta), left eye (magenta), nose tip, mouth center, right ear, left ear (gold)
- ~15fps detection rate via `requestAnimationFrame` loop
- Front/back camera switching with rotate icon FAB
- Automatic camera selection on mount
- Face detection model loaded lazily; detection silently fails if model doesn't load
- FPS counter in debug mode (shown while streaming)

**Key files:** `useFaceDetection.ts`, `faceDetection.ts`, `FaceOverlay.tsx`, `ARView.tsx`

### 2. Face Recognition & Enrollment

- 128-dim face embeddings via MobileFaceNet (ONNX Runtime Web, WASM backend)
- Cosine similarity matching against enrolled faces (configurable threshold, default 0.6)
- Auto-detect new faces → enrollment notification with thumbnail preview
  - Quality gates: min face width 100px, min confidence 0.8
  - 5-second debounce between enrollment triggers
  - User confirms with name input → saved to IndexedDB
- Recognized faces shown with green bounding boxes + name + confidence %
- "View [name]'s profile" button appears below recognized faces
- Recognition runs at ~1fps (throttled to avoid ONNX runtime overhead)
- Face recognition model loaded with 2 retry attempts; falls back to detection-only on failure
- Enrolled face thumbnails displayed in person detail page

**Key files:** `useFaceRecognition.ts`, `faceRecognition.ts`, `enrollment.ts`, `faceStore.ts`

### 3. Conversation Recording

- Microphone capture via MediaRecorder API with adaptive MIME type selection
  - Priority: `audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` → `audio/mp4`
- Speech-to-text via Cloudflare Workers AI Whisper (via `/api/stt` proxy) or Web Speech API (offline fallback)
- Live transcript preview via Web Speech API while recording
- Auto-restart Web Speech recognition loop while recording continues
- 5-minute max recording duration with auto-stop
- Conversation bubbles UI — user (accent color, right-aligned) / other (card color, left-aligned)
- Save/Discard actions after recording stops
- Rate-limited (500ms minimum between LLM calls)

**Key files:** `useSpeechToText.ts`, `speechToText.ts`, `ConversationView.tsx`

### 4. AI Memory Extraction

- Cloudflare Workers AI Llama 3.1 8B (via `/api/llm` proxy)
- Extracts:
  - `summary`: 2-3 sentence factual summary
  - `actionItems`: specific tasks mentioned (max 5)
  - `personUpdates`: new information about the person (max 5)
  - `keyMemories`: notable statements or events (max 3)
- Automatic extraction after each conversation (fire-and-forget, doesn't block save)
- Graceful fallback: conversation saved without structured data if API unavailable
- Short conversations are detected and skipped ("too short for meaningful extraction")
- Error categories: rate limit (429), auth failure (401), server error, network error

**Key files:** `useLLM.ts`, `llmService.ts`

### 5. Memory Timeline

- Reverse chronological view grouped by day header
- Day headers: "Today", "Yesterday", "2 days ago", or full date
- Memory type icons: conversation (chat), observation (eye), photo (camera), note (document)
- Color-coded type circles
- Memory cards with title, time, content snippet
- Action items displayed as tiny pills (first 3 shown, overflow count)
- Person name shown on each card (tappable → navigates to person detail)
- Refresh button with spin animation
- Loading skeleton (5 shimmering card placeholders)
- Empty state with clock icon + guidance text
- Error state with retry button

**Key files:** `MemoryTimeline.tsx`, `TimelinePage.tsx`, `memoryStore.ts`

### 6. Person Detail

- Avatar with initials fallback (deterministic color from name hash)
- Full name + relationship display
- "Last seen" and "Memories" count
- "Record Conversation" button → switches to conversation view
- Enrolled face thumbnails grid
- Memories section filtered to this person
- Loading spinner + error state with retry
- "No person selected" fallback

**Key files:** `PersonDetailPage.tsx`, `PersonCard.tsx`

### 7. Settings

- Cloudflare Account ID + API Token input (runtime, in-memory only — not persisted)
- Feature toggles: AR Autostart, Speech Recognition, Auto-capture
- Recognition threshold slider (0.5–0.9, step 0.05)
- Storage usage display (memories, people, faces, conversations)
- "Clear All Data" with two-step confirmation dialog
- App version display
- Loading spinner + error state with retry
- Inline error messages

**Key files:** `SettingsPage.tsx`, `settingsStore.ts`

### 8. PWA Support

- Installable progressive web app via vite-plugin-pwa
- Service worker with Workbox for offline caching
- Update banner when new version available (reload to activate)
- `autoUpdate` registration strategy
- Portrait orientation lock for mobile
- `apple-mobile-web-app-capable` for iOS home screen
- `safe-area-inset-*` for notch devices

**Config:** `vite.config.ts` (VitePWA plugin)

## UI States

Every screen in the app handles the following states:

| State | Implementation |
|-------|---------------|
| Loading | Spinner + descriptive text |
| Empty | Icon + message + hint text (what to do next) |
| Error | Error message + retry button where applicable |
| Success | Normal data rendering |
| Offline | Web Speech API fallback for STT; API proxy calls fail gracefully |

### Component State Matrix

| Component | Loading | Empty | Error | Success |
|-----------|---------|-------|-------|---------|
| Camera | Spinner + "Starting camera..." | — | Error + retry or permission screen | Video preview |
| AR View (face detection) | "Loading model..." indicator | — | Red overlay error message | Bounding boxes |
| AR View (face recognition) | "Recognition offline" indicator | — | Red overlay error message | Green name labels |
| Timeline | Skeleton cards (5 shimmer rows) | Clock icon + guidance | Alert + retry | Day-grouped cards |
| People | Spinner + "Loading people..." | People icon + hint | Silent (empty state) | Person cards |
| Person Detail | Spinner + "Loading person..." | Memories empty message | Error + retry | Profile + memories |
| Settings | Spinner + "Loading settings..." | — | Full error + retry | Settings form |
| Conversation | — | Mic icon + "Tap record to start" | Red error bar | Message bubbles |

## Data Storage

### IndexedDB Schema (5 object stores)

**memories** — key: `id` (UUID)
| Index | Key | Unique |
|-------|-----|--------|
| personId | personId | No |
| timestamp | timestamp | No |
| type | type | No |

**people** — key: `id` (UUID)
| Index | Key | Unique |
|-------|-----|--------|
| name | name | No |
| lastSeen | lastSeen | No |

**settings** — key: `id` (fixed: `app-settings`)

**conversations** — key: `id` (UUID)
| Index | Key | Unique |
|-------|-----|--------|
| personId | personId | No |
| timestamp | timestamp | No |

**faces** — key: `id` (UUID)
| Index | Key | Unique |
|-------|-----|--------|
| name | name | No |
| lastSeenAt | lastSeenAt | No |

All stores created via `idb` library in `src/store/db.ts`. Embeddings stored as `number[]` (IndexedDB structured clone limitation) and converted to/from `Float32Array` at the API boundary.

### Data Types

```typescript
MemoryEntry {
  id: string                  // UUID
  personId: string
  timestamp: number
  type: 'conversation' | 'observation' | 'photo' | 'note'
  title: string
  content: string             // JSON string for LLM-extracted data
  mediaUrl?: string
  createdAt: number
  updatedAt: number
}

Person {
  id: string
  name: string
  relationship: string
  thumbnailUrl?: string
  lastSeen: number
  createdAt: number
  updatedAt: number
}

ConversationSegment {
  id: string
  personId: string
  timestamp: number
  speaker: 'user' | 'other'
  text: string
}

AppSettings {
  id: string                  // always 'app-settings'
  language: string            // default: 'en'
  enableAR: boolean           // default: true
  enableSpeech: boolean       // default: true
  enableAutoCapture: boolean  // default: false
  recognitionThreshold: number // default: 0.7
  theme: 'dark' | 'light'    // default: 'dark'
  fontSize: 'normal' | 'large' | 'x-large'  // default: 'normal'
}

StoredFace {
  id: string
  name: string
  embedding: number[]         // 128-dim, stored as array for IndexedDB
  thumbnail: string            // JPEG data URL (112x112)
  createdAt: number
  updatedAt: number
  encounterCount: number
  lastSeenAt: number
}
```

### Memory Content Format

When a conversation is saved with LLM extraction, `MemoryEntry.content` contains:

```json
{
  "actionItems": ["Buy groceries", "Call doctor"],
  "personUpdates": ["Mentioned hip pain", "Prefers tea over coffee"],
  "keyMemories": ["Granddaughter graduated", "Trip to mountains"]
}
```

## Configuration Constants

All tunable constants in `src/lib/constants.ts`:

### Camera
- `DEFAULT_CAMERA_CONFIG`: facingMode: 'user', resolution: 1280x720, frameRate: 15
- `SUPPORTED_RESOLUTIONS`: 1080p, 720p, VGA, QVGA
- `CAMERA_ERROR_MESSAGES`: Maps DOMException names to user-facing messages

### Face Detection
- `MODEL_URL`: MediaPipe BlazeFace (short range) TF Lite model
- `WASM_CDN`: jsDelivr CDN for MediaPipe WASM files
- `MIN_CONFIDENCE`: 0.5
- `TARGET_FPS`: 15
- `INTERVAL_MS`: 66

### Face Recognition
- `MODEL_PATH`: MobileFaceNet ONNX from OpenCV Zoo (configurable via env)
- `INPUT_SHAPE`: [1, 3, 112, 112]
- `SIMILARITY_THRESHOLD`: 0.6
- `ENROLL_MIN_CONFIDENCE`: 0.8
- `ENROLL_DEBOUNCE_MS`: 5000
- `ENROLL_MIN_FACE_WIDTH`: 100
- `WASM_CDN`: onnxruntime-web CDN path

### LLM
- `MODEL`: llama-3.1-8b-instant
- `TEMPERATURE`: 0.3
- `MAX_TOKENS`: 512
- `RATE_LIMIT_RPM`: 300 (Workers AI rate limit)
- `DAILY_LIMIT_RPD`: 1300 (conservative ~10k neuron budget)

### STT
- `MODEL`: whisper-large-v3-turbo
- `TEMPERATURE`: 0.1
- `LANGUAGE`: en
- `MAX_RECORDING_DURATION_MS`: 300000 (5 min)
- `AUDIO_MIME_TYPE`: audio/webm

## CSS Architecture

Single-file stylesheet (`src/index.css`) organized by component sections:

| Section | Prefix | Key Classes |
|---------|--------|-------------|
| Camera | `.camera-*` | container, video, loading, error, permission, switch-btn |
| AR Overlay | `.camera-overlay-*`, `.face-overlay-*` | overlay-top, streaming-indicator, hint, face-overlay-canvas |
| Detection | `.detection-*`, `.model-*` | fps, loading-indicator, error-overlay |
| Enrollment | `.enrollment-*` | notification, thumbnail, info, btn, name-input |
| Conversation | `.conversation-*` | container, messages, bubble, controls, record-btn |
| Timeline | `.timeline-*` | page, day-header, empty, skeleton, error |
| Memory Card | `.memory-card-*` | card, icon, title, snippet, action-items, pill |
| People | `.people-*` | page, loading, empty, list |
| Person Card | `.person-card-*` | card, avatar, initials, name, last-seen, count |
| Person Detail | `.person-detail-*` | page, header, profile, thumbnail, meta, faces |
| Settings | `.settings-*` | page, section, row, input, toggle, slider, danger-btn |

### CSS Variables

```css
--bg-primary: #0f0f23;       /* Main background */
--bg-secondary: #1a1a2e;     /* Cards, nav, headers */
--bg-card: #16213e;          /* Card surfaces */
--text-primary: #e0e0e0;     /* Primary text */
--text-secondary: #a0a0b0;   /* Secondary/subtle text */
--accent: #00d4ff;           /* Primary action (cyan) */
--accent-secondary: #7b2ff7; /* Secondary accent (purple) */
--danger: #ff4757;           /* Destructive actions */
--success: #2ed573;          /* Recognition match */
--nav-height: 64px;          /* Bottom nav bar height */
--safe-bottom: env(safe-area-inset-bottom, 0px);  /* Notch safe area */
```

Animations: `camera-spin`, `pulse-dot`, `slide-up`, `record-pulse`, `skeleton-pulse`, `timeline-spin`.

## Privacy & Data

- **All face data stays on-device** — face embeddings stored in IndexedDB, never uploaded
- Cloudflare Workers AI receives anonymized audio (for STT) and text (for LLM extraction) via our server-side proxy
- No data sent to any other third party
- No accounts (other than Cloudflare for AI), no cloud storage, no tracking analytics
- Camera and mic access required only for active features
- Cloudflare credentials are configurable at runtime and stored only in memory (not persisted to disk)

## Cloudflare Workers AI Free Tier Limits

| Feature | Model | Limit |
|---------|-------|-------|
| LLM Extraction | Llama 3.1 8B (fp8-fast) | ~1300 extractions/day (10k neurons) |
| Speech-to-Text | Whisper large v3 turbo | ~214 min of audio/day (10k neurons) |
| Rate limiter | — | 300 req/min text, generous audio limits |
| Credit card required | — | No |

## Error Handling

The app handles these scenarios:

| Scenario | Detection | User Experience |
|----------|-----------|-----------------|
| Camera permission denied | `NotAllowedError` | Permission screen with icon + retry button |
| No camera available | `NotFoundError` | "No camera found" message |
| Camera in use | `NotReadableError` | "Camera is in use" message |
| HTTP (not HTTPS) | Protocol check | Red warning banner at top |
| IndexedDB unavailable | Feature detection | Purple warning banner |
| Face detection model fail | Catch in init | Red overlay: "Face detection: [error]" |
| Face recognition model fail | Catch in init | Red overlay: "Face recognition: [error]" |
| Both models fail | Independent init | Detection-only mode; "Recognition offline" indicator |
| Mic permission denied | `NotAllowedError` | "Microphone access denied" message |
| No microphone | `NotFoundError` | "No microphone found" message |
| Cloudflare creds missing | Key check | "Cloudflare credentials not configured" |
| Workers AI rate limited | 429 response | "Rate limit reached. Please wait." |
| Workers AI auth failure | 401/403 response | "Cloudflare API token is invalid." |
| Workers AI quota exceeded | Neuron cap | "Daily AI quota exceeded." |
| API proxy unavailable | 502 response | "Transcription/LLM service not available" |
| Storage full | Write failure | Handled per-operation |
| Private browsing | IndexedDB quota | Warning banner, graceful degradation |

## Browser Support

| Browser | Camera | Face Detection | Face Recognition | STT | Notes |
|---------|--------|---------------|-----------------|-----|-------|
| Chrome Android | Yes | Yes | Yes | Yes | Primary target |
| Safari iOS 16.4+ | Yes | Yes | Yes | Limited | Requires HTTPS; Web Speech partial |
| Chrome Desktop | Yes | Yes | Yes | Yes | Full support |
| Firefox Desktop | Yes | Partial | Partial | Yes | WebGL/WASM limitations |
| Samsung Internet | Yes | Yes | Yes | Limited | Chromium-based |

## Troubleshooting

### Camera doesn't start
- Ensure you're on HTTPS or localhost (the app shows a red banner if on HTTP)
- Check browser permissions: camera access must be allowed
- On iOS: Safari requires a user gesture before `getUserMedia()` works (tap the screen first)
- On desktop: some laptops have a physical camera shutter

### Face detection not working
- Check browser console for MediaPipe WASM loading errors
- Ensure good lighting on the subject's face
- Face must be at least 100px wide in the frame
- The model loads asynchronously; wait for "Loading model..." to disappear
- If the model fails, bounding boxes simply won't appear (graceful degradation)

### Face recognition not working
- Enroll a face first via the enrollment notification in AR view
- Check recognition threshold in Settings (default 0.6)
- Recognition only runs at ~1fps; hold the face steady for a moment
- If the ONNX model fails to load, a "Recognition offline" indicator appears
- The model is ~10MB and loaded from GitHub; may take several seconds

### STT/LLM not working
- Verify VITE_CLOUDFLARE_ACCOUNT_ID and VITE_CLOUDFLARE_API_TOKEN are set in `.env` or entered in Settings
- API proxy requires `wrangler pages dev` to be running during development — use `pnpm dev:pages`
- Check that your Cloudflare API token has `workers-ai:run` permission
- Cloudflare Workers AI free tier: 10k neurons/day; check usage in Cloudflare dashboard
- Without API proxy, Web Speech API provides basic STT in supported browsers
- Without any STT, conversations can still be saved manually

## Performance Notes

- Face detection runs at ~15fps via `requestAnimationFrame` throttle
- Face recognition runs at ~1fps to avoid blocking the ONNX WASM runtime
- ONNX Runtime Web loads ~10MB of WASM files on first use (cached by browser)
- MediaPipe Tasks Vision loads ~4MB of WASM files
- Face crop + ONNX inference takes ~200-500ms per frame
- All ML models are lazy-loaded on first use
- Embedding comparison (cosine similarity) is O(n) per enrolled face — fine for dozens of faces
- IndexedDB operations are async and non-blocking

## License

MIT
