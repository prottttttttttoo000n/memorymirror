import { useState, useEffect, useCallback } from 'react'
import { getRecentMemories } from '@/services/memoryDB'
import type { MemoryEntry } from '@/types/index.d.ts'

interface UseMemoryDBReturn {
  memories: MemoryEntry[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useMemoryDB(): UseMemoryDBReturn {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const data = await getRecentMemories()
      setMemories(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    memories,
    isLoading,
    error,
    refresh,
  }
}
