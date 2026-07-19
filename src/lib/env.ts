/** Environment configuration loaded from runtime */

// ── Runtime API key overrides (in-memory, not persisted) ──────────────
let runtimeCloudflareApiToken: string | null = null
let runtimeCloudflareAccountId: string | null = null

/**
 * Override the Cloudflare API token at runtime (stored in memory only).
 * Pass `null` to clear the runtime override and fall back to env var.
 */
export function setCloudflareApiToken(token: string | null): void {
  runtimeCloudflareApiToken = token
}

/** Standalone accessor for Cloudflare API token. */
export function getCloudflareApiToken(): string | null {
  return runtimeCloudflareApiToken ?? (import.meta.env.VITE_CLOUDFLARE_API_TOKEN as string | undefined) ?? null
}

/**
 * Override the Cloudflare Account ID at runtime.
 */
export function setCloudflareAccountId(id: string | null): void {
  runtimeCloudflareAccountId = id
}

/** Standalone accessor for Cloudflare Account ID. */
export function getCloudflareAccountId(): string | null {
  return runtimeCloudflareAccountId ?? (import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID as string | undefined) ?? null
}

export const ENV = {
  get CLOUDFLARE_API_TOKEN(): string | undefined {
    return import.meta.env.VITE_CLOUDFLARE_API_TOKEN as string | undefined
  },
  get CLOUDFLARE_ACCOUNT_ID(): string | undefined {
    return import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID as string | undefined
  },
  get ENABLE_MOCK(): boolean {
    return import.meta.env.VITE_ENABLE_MOCK === 'true'
  },
  get IS_DEV(): boolean {
    return import.meta.env.DEV
  },
  get IS_PROD(): boolean {
    return import.meta.env.PROD
  },

  /** Camera resolution target: '720p' | '1080p' | null (auto) */
  get CAMERA_RESOLUTION(): '720p' | '1080p' | null {
    const val = import.meta.env.VITE_CAMERA_RESOLUTION as string | undefined
    if (val === '720p') return '720p'
    if (val === '1080p') return '1080p'
    return null
  },
  /** Preferred facing mode: 'user' | 'environment' */
  get CAMERA_FACING_MODE(): 'user' | 'environment' {
    const val = import.meta.env.VITE_CAMERA_FACING_MODE as string | undefined
    if (val === 'environment') return 'environment'
    return 'user'
  },
  /** Minimum frame rate for camera stream */
  get CAMERA_MIN_FPS(): number {
    const val = parseInt(import.meta.env.VITE_CAMERA_MIN_FPS as string, 10)
    return Number.isFinite(val) && val > 0 ? val : 15
  },
} as const
