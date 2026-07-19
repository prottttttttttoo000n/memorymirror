import { useState, useEffect, useCallback } from 'react'
import { getSettings, saveSettings, getStorageUsage } from '@/store/settingsStore'
import { setCloudflareApiToken, getCloudflareApiToken, setCloudflareAccountId, getCloudflareAccountId } from '@/lib/env'
import { APP_VERSION } from '@/lib/constants'
import { deleteMemory } from '@/store/memoryStore'
import { getDB } from '@/store/db'
import { STORE_NAMES } from '@/lib/constants'
import type { AppSettings } from '@/types/index.d.ts'

// ── Component ───────────────────────────────────────────────────────

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cloudflare credentials (stored in-memory, not persisted)
  const [cfAccountId, setCfAccountId] = useState('')
  const [cfApiToken, setCfApiToken] = useState('')
  const [cfDirty, setCfDirty] = useState(false)

  // Clear data confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Storage usage
  const [storageUsage, setStorageUsage] = useState<{
    memories: number
    people: number
    faces: number
    conversations: number
  } | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [s, usage] = await Promise.all([
        getSettings(),
        getStorageUsage(),
      ])
      setSettings(s)
      setStorageUsage(usage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = useCallback(
    async (updates: Partial<AppSettings>) => {
      if (!settings) return
      try {
        const updated = await saveSettings(updates)
        setSettings(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save settings')
      }
    },
    [settings],
  )

  const handleCloudflareSave = useCallback(() => {
    const trimmedToken = cfApiToken.trim()
    const trimmedId = cfAccountId.trim()
    if (trimmedToken) {
      setCloudflareApiToken(trimmedToken)
    } else {
      setCloudflareApiToken(null)
    }
    if (trimmedId) {
      setCloudflareAccountId(trimmedId)
    } else {
      setCloudflareAccountId(null)
    }
    setCfDirty(false)
  }, [cfApiToken, cfAccountId])

  const handleClearData = useCallback(async () => {
    setIsClearing(true)
    try {
      const db = await getDB()
      const tx = db.transaction(
        [
          STORE_NAMES.MEMORIES,
          STORE_NAMES.CONVERSATIONS,
          STORE_NAMES.FACES,
          STORE_NAMES.PEOPLE,
        ],
        'readwrite',
      )
      tx.objectStore(STORE_NAMES.MEMORIES).clear()
      tx.objectStore(STORE_NAMES.CONVERSATIONS).clear()
      tx.objectStore(STORE_NAMES.FACES).clear()
      tx.objectStore(STORE_NAMES.PEOPLE).clear()
      await tx.done

      setStorageUsage({ memories: 0, people: 0, faces: 0, conversations: 0 })
      setShowClearConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data')
    } finally {
      setIsClearing(false)
    }
  }, [])

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <h2 className="settings-header-title">Settings</h2>
        </div>
        <div className="settings-loading">
          <div className="camera-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────
  if (error && !settings) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <h2 className="settings-header-title">Settings</h2>
        </div>
        <div className="settings-error">
          <p>{error}</p>
          <button className="settings-retry-btn" onClick={loadSettings} type="button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const s = settings!

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="settings-header-title">Settings</h2>
      </div>

      <div className="settings-scroll">
        {/* ── Cloudflare Credentials ────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Cloudflare Credentials</h3>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Required for AI features (STT + LLM). Store in memory only, never
            persisted to disk. Set via .env or this panel.
          </p>

          <div className="settings-row">
            <label className="settings-label" htmlFor="cf-account-id">
              Account ID
            </label>
            <input
              id="cf-account-id"
              className="settings-input"
              type="text"
              placeholder={
                getCloudflareAccountId()
                  ? '••••••••••••••••'
                  : 'Your Cloudflare Account ID'
              }
              value={cfAccountId}
              onChange={(e) => {
                setCfAccountId(e.target.value)
                setCfDirty(true)
              }}
            />
          </div>

          <div className="settings-row">
            <label className="settings-label" htmlFor="cf-api-token">
              API Token
            </label>
            <div className="settings-input-group">
              <input
                id="cf-api-token"
                className="settings-input"
                type="password"
                placeholder={
                  getCloudflareApiToken()
                    ? '••••••••••••••••'
                    : 'Cloudflare API token'
                }
                value={cfApiToken}
                onChange={(e) => {
                  setCfApiToken(e.target.value)
                  setCfDirty(true)
                }}
              />
              {cfDirty && (
                <button
                  className="settings-save-btn"
                  onClick={handleCloudflareSave}
                  type="button"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Features</h3>

          <div className="settings-row">
            <span className="settings-label">AR Autostart</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.enableAR}
                onChange={(e) => handleSave({ enableAR: e.target.checked })}
              />
              <span className="settings-toggle-track">
                <span className="settings-toggle-thumb" />
              </span>
            </label>
          </div>

          <div className="settings-row">
            <span className="settings-label">Speech Recognition</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.enableSpeech}
                onChange={(e) => handleSave({ enableSpeech: e.target.checked })}
              />
              <span className="settings-toggle-track">
                <span className="settings-toggle-thumb" />
              </span>
            </label>
          </div>

          <div className="settings-row">
            <span className="settings-label">Auto-capture</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={s.enableAutoCapture}
                onChange={(e) =>
                  handleSave({ enableAutoCapture: e.target.checked })
                }
              />
              <span className="settings-toggle-track">
                <span className="settings-toggle-thumb" />
              </span>
            </label>
          </div>
        </section>

        {/* ── Recognition ──────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Recognition</h3>

          <div className="settings-row">
            <span className="settings-label">
              Threshold: {s.recognitionThreshold.toFixed(1)}
            </span>
            <div className="settings-slider-group">
              <input
                type="range"
                className="settings-slider"
                min="0.5"
                max="0.9"
                step="0.05"
                value={s.recognitionThreshold}
                onChange={(e) =>
                  handleSave({
                    recognitionThreshold: parseFloat(e.target.value),
                  })
                }
              />
              <div className="settings-slider-labels">
                <span>0.5</span>
                <span>0.9</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Appearance ───────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>

          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <span className="settings-value">Dark</span>
          </div>
        </section>

        {/* ── Data Management ──────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Data</h3>

          {storageUsage && (
            <div className="settings-storage-usage">
              <div className="settings-row">
                <span className="settings-label">Memories</span>
                <span className="settings-value">{storageUsage.memories}</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">People</span>
                <span className="settings-value">{storageUsage.people}</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">Faces</span>
                <span className="settings-value">{storageUsage.faces}</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">Conversations</span>
                <span className="settings-value">
                  {storageUsage.conversations}
                </span>
              </div>
            </div>
          )}

          {!showClearConfirm ? (
            <button
              className="settings-danger-btn"
              onClick={() => setShowClearConfirm(true)}
              type="button"
            >
              Clear All Data
            </button>
          ) : (
            <div className="settings-confirm-group">
              <p className="settings-confirm-text">
                This will permanently delete all memories, conversations, face
                data, and enrolled people. This action cannot be undone.
              </p>
              <div className="settings-confirm-actions">
                <button
                  className="settings-danger-btn"
                  onClick={handleClearData}
                  disabled={isClearing}
                  type="button"
                >
                  {isClearing ? 'Clearing...' : 'Confirm Delete'}
                </button>
                <button
                  className="settings-cancel-btn"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── About ────────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">About</h3>
          <div className="settings-row">
            <span className="settings-label">App Version</span>
            <span className="settings-value">{APP_VERSION}</span>
          </div>
        </section>

        {/* Inline error */}
        {error && (
          <div className="settings-inline-error">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
