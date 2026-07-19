# MemoryMirror

**AR-powered memory prosthetic** — point your phone at someone you know, and MemoryMirror recognizes their face, records conversations, and builds a searchable timeline of memories.

Real-time face detection + recognition runs entirely on-device (MediaPipe + ONNX). Speech-to-text and AI memory extraction use Cloudflare Workers AI (free tier). All data stays on your phone.

## Quick Start

```bash
pnpm install
pnpm dev              # Vite dev server (face detection works, no AI)
pnpm dev:pages        # also run this for AI features (separate terminal)
```

Need AI features? Get Cloudflare credentials at https://dash.cloudflare.com/signup (free, no credit card) and set them in the app's Settings page or `.env`:

```
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id
VITE_CLOUDFLARE_API_TOKEN=your_api_token
```

Open http://localhost:5173 (or http://localhost:8788 with AI proxy).

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
| Face Recognition | MobileFaceNet via ONNX Runtime Web (WASM, client-side) | $0 |
| Speech-to-Text | Cloudflare Workers AI Whisper | $0 (~10k neurons/day) |
| LLM Extraction | Cloudflare Workers AI Llama 3.1 8B | $0 (~10k neurons/day) |
| Hosting | Cloudflare Pages | $0 |
| Storage | IndexedDB (browser built-in) | $0 |

All face data stays on-device. Only anonymized audio and text are sent to Cloudflare Workers AI via a server-side proxy.

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
