// ── Types ───────────────────────────────────────────────────────────

export interface PersonCardProps {
  name: string
  relationship?: string
  thumbnailUrl?: string
  lastSeen?: number
  memoryCount?: number
  onClick?: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Format a timestamp as a relative time string. */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 2) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(ts).toLocaleDateString()
}

/** Generate a deterministic color from a string. */
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

/** Get initials (max 2 characters). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ── Component ───────────────────────────────────────────────────────

export function PersonCard({
  name,
  relationship,
  thumbnailUrl,
  lastSeen,
  memoryCount,
  onClick,
}: PersonCardProps) {
  const initialsColor = getInitialsColor(name)

  return (
    <button className="person-card" onClick={onClick} type="button">
      <div className="person-card-avatar">
        {thumbnailUrl ? (
          <img
            className="person-card-img"
            src={thumbnailUrl}
            alt={name}
          />
        ) : (
          <div
            className="person-card-initials"
            style={{ background: initialsColor }}
          >
            {getInitials(name)}
          </div>
        )}
      </div>

      <div className="person-card-info">
        <span className="person-card-name">{name}</span>
        {relationship && (
          <span className="person-card-relationship">{relationship}</span>
        )}
        {lastSeen !== undefined && (
          <span className="person-card-last-seen">
            Seen {formatRelativeTime(lastSeen)}
          </span>
        )}
      </div>

      {memoryCount !== undefined && memoryCount > 0 && (
        <div className="person-card-memory-count">
          <span>{memoryCount}</span>
        </div>
      )}

      <svg
        className="person-card-chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}
