# MemoryMirror

**AR-powered memory prosthetic** — point your phone at someone you know, and MemoryMirror recognizes their face, records conversations, and builds a searchable timeline of memories.

Real-time face detection + recognition runs entirely on-device (MediaPipe + ONNX). Speech-to-text and AI memory extraction use Cloudflare Workers AI (free tier). All data stays on your phone.

## Quick Start

```bash
pnpm install
pnpm dev              # Vite dev server (face detection works, no AI)
pnpm dev:pages        # also run this for AI features (separate terminal)
```

Need AI features? Get Cloudflare credentials at https://dash.cloudflare.com/signup (free, no credit card).

### Local Dev

```bash
# Terminal 1: Vite dev server
pnpm dev

# Terminal 2: Wrangler AI proxy (for STT + LLM)
pnpm dev:pages
```

Create a `.dev.vars` file in the project root:
```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

Open http://localhost:8788 (Wrangler serves the app + API proxy).

### Production (pages.dev)

For audio transcription and LLM features on the deployed site, you must set Cloudflare secrets:

```bash
npx wrangler pages secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler pages secret put CLOUDFLARE_API_TOKEN
```

These are different from Vite env vars — they're injected into Pages Functions server-side.

## Features

- **Face Detection & Recognition** — real-time bounding boxes, landmarks, name labels. All on-device, no upload.
- **Auto-Enrollment** — sees a new face, asks who it is, remembers them.
- **Conversation Recording** — tap record, get transcripts via Whisper AI.
- **Memory Extraction** — LLM extracts summaries, action items, and key memories from conversations.
- **Timeline** — searchable, day-grouped view of all memories.
- **Person Profiles** — see everything you've recorded about someone.
- **PWA** — installable on your phone's home screen. Works offline.

## Architecture

| Component | Technology | Cost |
|-----------|-----------|------|
| Face Detection | MediaPipe BlazeFace (WASM, client-side) | $0 |
| Face Recognition | MobileFaceNet via ONNX Runtime Web (WASM, client-side, uses local non-threaded ORT WASM) | $0 |
| Speech-to-Text | Cloudflare Workers AI Whisper | $0 (~10k neurons/day) |
| LLM Extraction | Cloudflare Workers AI Llama 3.1 8B | $0 (~10k neurons/day) |
| Hosting | Cloudflare Pages | $0 |
| Storage | IndexedDB (browser built-in) | $0 |

All face data stays on-device. Only anonymized audio and text are sent to Cloudflare Workers AI via a server-side proxy.

### Face Recognition Deployment Notes

`onnxruntime-web` is pinned to **1.17.1** because newer versions (1.21+) removed non-threaded WASM binaries. Cloudflare Pages doesn't set COOP/COEP headers, so threaded WASM (which requires `SharedArrayBuffer`) hangs indefinitely.

We host the 1.17.1 non-threaded WASM files (`ort-wasm-simd.wasm`, `ort-wasm.wasm`) in `public/wasm/` and serve them at `/wasm/`. The `WASM_CDN` constant in `src/lib/constants.ts` points there. When `numThreads=1`, ORT 1.17.1 selects the non-threaded SIMD WASM variant automatically.

**If you ever upgrade `onnxruntime-web`**, verify the new version ships non-threaded WASM binaries (`ort-wasm-simd.wasm` and `ort-wasm.wasm`). If not, you must either:
- Pin back to 1.17.1, or
- Serve non-threaded WASM files yourself from the matching version.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Vite dev server (HMR) |
| `pnpm dev:pages` | Wrangler Pages dev with AI proxy |
| `pnpm build` | TypeScript check + production build |
| `pnpm lint` | Oxlint |
| `pnpm tunnel` | HTTPS URL for mobile testing |
| `pnpm preview` | Preview production build locally |

## Browser Support

Chrome Android, Safari iOS 16.4+, Chrome/Firefox Desktop. Requires HTTPS for camera/mic access.

## License

MIT — see [LICENSE](LICENSE).
