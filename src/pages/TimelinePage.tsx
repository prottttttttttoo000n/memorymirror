import { useState, useEffect, useCallback } from 'react'
import { MemoryTimeline } from '@/components/MemoryTimeline'
import { getMemories } from '@/store/memoryStore'
import type { MemoryEntry } from '@/types/index.d.ts'

interface TimelinePageProps {
  onMemoryClick?: (memory: MemoryEntry) => void
}

export function TimelinePage({ onMemoryClick }: TimelinePageProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getMemories()
      setMemories(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load memories',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  return (
    <div className="timeline-page-wrapper">
      <div className="timeline-header">
        <h2 className="timeline-header-title">Memory Timeline</h2>
        <button
          className="timeline-refresh-btn"
          onClick={loadMemories}
          disabled={isLoading}
          type="button"
          aria-label="Refresh memories"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoading ? 'timeline-refresh-spin' : undefined}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {error ? (
        <div className="timeline-error">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="timeline-error-text">{error}</p>
          <button
            className="timeline-retry-btn"
            onClick={loadMemories}
            type="button"
          >
            Try Again
          </button>
        </div>
      ) : (
        <MemoryTimeline
          memories={memories}
          loading={isLoading}
          onMemoryClick={onMemoryClick}
          showPersonName={true}
        />
      )}
    </div>
  )
}
