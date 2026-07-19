import { useState, useEffect, useCallback } from 'react'
import { MemoryTimeline } from '@/components/MemoryTimeline'
import { ConversationView } from '@/components/ConversationView'
import { getPerson } from '@/store/faceStore'
import { getMemories } from '@/store/memoryStore'
import { getAllFaces } from '@/store/faceStore'
import type { MemoryEntry, Person } from '@/types/index.d.ts'
import type { StoredFace } from '@/store/db'

// ── Types ───────────────────────────────────────────────────────────

export interface PersonDetailPageProps {
  personId: string | null
  onBack?: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(ts).toLocaleDateString()
}

function getInitialsColor(name: string): string {
  const colors = [
    'var(--accent)',
    'var(--accent-secondary)',
    '#ff6b6b',
    '#ffa502',
    '#2ed573',
    '#1e90ff',
    '#a29bfe',
    '#fd79a8',
    '#00cec9',
    '#e17055',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ── Component ───────────────────────────────────────────────────────

export function PersonDetailPage({ personId, onBack }: PersonDetailPageProps) {
  const [person, setPerson] = useState<Person | null>(null)
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [faces, setFaces] = useState<StoredFace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)

  const loadData = useCallback(async () => {
    if (!personId) return
    setIsLoading(true)
    setError(null)
    try {
      const [personData, memoryData, allFaces] = await Promise.all([
        getPerson(personId),
        getMemories(personId),
        getAllFaces(),
      ])
      if (personData) {
        setPerson(personData)
      } else {
        setError('Person not found')
      }
      setMemories(memoryData)
      setFaces(allFaces.filter((f) => f.name === personData?.name))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load person data',
      )
    } finally {
      setIsLoading(false)
    }
  }, [personId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // We need a valid personId to render
  if (!personId) {
    return (
      <div className="person-detail-page">
        <div className="person-detail-error">
          <p>No person selected.</p>
        </div>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="person-detail-page">
        <div className="person-detail-loading">
          <div className="camera-spinner" />
          <p>Loading person details...</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────
  if (error || !person) {
    return (
      <div className="person-detail-page">
        <div className="person-detail-header">
          <button className="person-detail-back" onClick={onBack} type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <div className="person-detail-error">
          <p>{error || 'Person not found'}</p>
          <button className="person-detail-retry-btn" onClick={loadData} type="button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Toggle between conversation view and profile view ──────────
  if (showConversation) {
    return (
      <div className="person-detail-page">
        <div className="person-detail-header">
          <button
            className="person-detail-back"
            onClick={() => setShowConversation(false)}
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="person-detail-header-name">{person.name}</span>
        </div>
        <ConversationView personId={person.id} personName={person.name} />
      </div>
    )
  }

  // ── Full profile view ─────────────────────────────────────────
  const initialsColor = getInitialsColor(person.name)

  return (
    <div className="person-detail-page">
      {/* Header with back button */}
      <div className="person-detail-header">
        <button className="person-detail-back" onClick={onBack} type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="person-detail-header-name">{person.name}</span>
      </div>

      {/* Scrollable content */}
      <div className="person-detail-scroll">
        {/* Profile section */}
        <div className="person-detail-profile">
          <div className="person-detail-thumbnail">
            {person.thumbnailUrl ? (
              <img
                className="person-detail-thumbnail-img"
                src={person.thumbnailUrl}
                alt={person.name}
              />
            ) : (
              <div
                className="person-detail-initials"
                style={{ background: initialsColor }}
              >
                {getInitials(person.name)}
              </div>
            )}
          </div>

          <div className="person-detail-info">
            <h2 className="person-detail-name">{person.name}</h2>
            {person.relationship && (
              <p className="person-detail-relationship">{person.relationship}</p>
            )}
          </div>

          <div className="person-detail-meta">
            <div className="person-detail-meta-item">
              <span className="person-detail-meta-label">Last seen</span>
              <span className="person-detail-meta-value">
                {formatRelativeTime(person.lastSeen)}
              </span>
            </div>
            <div className="person-detail-meta-item">
              <span className="person-detail-meta-label">Memories</span>
              <span className="person-detail-meta-value">{memories.length}</span>
            </div>
          </div>

          <button
            className="person-detail-record-btn"
            onClick={() => setShowConversation(true)}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Record Conversation
          </button>
        </div>

        {/* Face thumbnails */}
        {faces.length > 0 && (
          <div className="person-detail-faces">
            <h3 className="person-detail-section-title">Enrolled Faces</h3>
            <div className="person-detail-faces-grid">
              {faces.map((face) => (
                <div key={face.id} className="person-detail-face-item">
                  <img
                    className="person-detail-face-thumb"
                    src={face.thumbnail}
                    alt={`${person.name} face`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memories */}
        <div className="person-detail-memories-section">
          <h3 className="person-detail-section-title">
            Memories with {person.name}
          </h3>
          <MemoryTimeline
            memories={memories}
            loading={false}
            emptyMessage={`No conversations with ${person.name} yet.`}
            showPersonName={false}
          />
        </div>
      </div>
    </div>
  )
}
