import type { MemoryEntry } from '@/types/index.d.ts'

// ── Types ───────────────────────────────────────────────────────────

export interface MemoryTimelineProps {
  memories: MemoryEntry[]
  loading?: boolean
  emptyMessage?: string
  onMemoryClick?: (memory: MemoryEntry) => void
  showPersonName?: boolean
}

/** Parsed structured content from a memory entry's JSON content field. */
interface MemoryContent {
  actionItems?: string[]
  personUpdates?: string[]
  keyMemories?: string[]
  summary?: string
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

/** Format a timestamp as a short time string. */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Get the day key for grouping (YYYY-MM-DD). */
function getDayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Format a day key into a human-readable header. */
function formatDayHeader(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const yesterday2 = new Date(today)
  yesterday2.setDate(yesterday2.getDate() - 2)
  if (date.toDateString() === yesterday2.toDateString()) return '2 days ago'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

/** Try to parse memory content as JSON; return null if not JSON. */
function parseContent(content: string): MemoryContent | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object') {
      return parsed as MemoryContent
    }
    return null
  } catch {
    return null
  }
}

/** Extract a snippet from memory content for display. */
function getSnippet(memory: MemoryEntry): string {
  const parsed = parseContent(memory.content)
  if (parsed?.summary && parsed.summary.length > 0) {
    return parsed.summary.length > 120
      ? parsed.summary.slice(0, 120) + '…'
      : parsed.summary
  }
  return memory.content.length > 120
    ? memory.content.slice(0, 120) + '…'
    : memory.content
}

/** Group memories by day, preserving reverse-chronological order. */
function groupByDay(
  memories: MemoryEntry[],
): Array<{ dayKey: string; timestamp: number; items: MemoryEntry[] }> {
  const groups = new Map<string, MemoryEntry[]>()
  for (const m of memories) {
    const key = getDayKey(m.timestamp)
    const list = groups.get(key)
    if (list) {
      list.push(m)
    } else {
      groups.set(key, [m])
    }
  }

  return Array.from(groups.entries())
    .map(([dayKey, items]) => ({
      dayKey,
      timestamp: items[0].timestamp,
      items,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

// ── Type icons (inline SVGs) ────────────────────────────────────────

const TypeIcons: Record<MemoryEntry['type'], React.JSX.Element> = {
  conversation: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  observation: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  photo: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  note: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
}

// ── Component ───────────────────────────────────────────────────────

export function MemoryTimeline({
  memories,
  loading = false,
  emptyMessage = 'No memories yet. Conversations you save will appear here.',
  onMemoryClick,
  showPersonName = true,
}: MemoryTimelineProps) {
  // ── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="timeline-page">
        <div className="timeline-skeleton-list">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="memory-card memory-card-skeleton">
              <div className="memory-card-skeleton-row">
                <div className="skeleton-block skeleton-icon" />
                <div className="skeleton-block skeleton-line skeleton-line-wide" />
              </div>
              <div className="skeleton-block skeleton-line" />
              <div className="skeleton-block skeleton-line skeleton-line-short" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────
  if (memories.length === 0) {
    return (
      <div className="timeline-page">
        <div className="timeline-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <p className="timeline-empty-text">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  // ── Grouped timeline ───────────────────────────────────────────
  const dayGroups = groupByDay(memories)

  return (
    <div className="timeline-page">
      {dayGroups.map((group) => (
        <div key={group.dayKey}>
          <div className="timeline-day-header">
            <span>{formatDayHeader(group.timestamp)}</span>
          </div>

          {group.items.map((memory) => {
            const content = parseContent(memory.content)
            const actionItems = content?.actionItems
            const hasActionItems =
              Array.isArray(actionItems) && actionItems.length > 0

            return (
              <button
                key={memory.id}
                className="memory-card"
                onClick={() => onMemoryClick?.(memory)}
                type="button"
              >
                <div className="memory-card-main">
                  <div className={`memory-card-icon memory-card-icon--${memory.type}`}>
                    {TypeIcons[memory.type]}
                  </div>

                  <div className="memory-card-body">
                    <div className="memory-card-top">
                      <span className="memory-card-title">{memory.title}</span>
                      <span className="memory-card-time">{formatTime(memory.timestamp)}</span>
                    </div>

                    <p className="memory-card-snippet">{getSnippet(memory)}</p>

                    {hasActionItems && (
                      <div className="memory-card-action-items">
                        {actionItems!.slice(0, 3).map((item, idx) => (
                          <span key={idx} className="action-item-pill">{item}</span>
                        ))}
                        {actionItems!.length > 3 && (
                          <span className="action-item-pill action-item-pill--more">
                            +{actionItems!.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
