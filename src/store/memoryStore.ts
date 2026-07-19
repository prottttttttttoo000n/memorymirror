/**
 * Memory store — CRUD operations for MemoryEntry objects in IndexedDB.
 *
 * Each memory entry stores a timestamped, typed record of a conversation,
 * observation, photo, or note. Conversation memories contain LLM-extracted
 * structured data (action items, summaries, person updates) serialised
 * in the `content` field as JSON.
 */

import { getDB } from './db'
import { STORE_NAMES } from '@/lib/constants'
import type { MemoryEntry } from '@/types/index.d.ts'

/**
 * Retrieve all memory entries, optionally filtered by person.
 *
 * When `personId` is omitted, returns every memory entry ordered by
 * timestamp (newest first).
 */
export async function getMemories(personId?: string): Promise<MemoryEntry[]> {
  const db = await getDB()

  if (personId) {
    const index = db.transaction(STORE_NAMES.MEMORIES).store.index('personId')
    const entries = await index.getAll(personId)
    entries.sort((a, b) => b.timestamp - a.timestamp)
    return entries
  }

  const index = db.transaction(STORE_NAMES.MEMORIES).store.index('timestamp')
  const entries = await index.getAll()
  entries.reverse() // newest first
  return entries
}

/**
 * Retrieve a single memory entry by its ID.
 *
 * Returns `undefined` if no entry with that ID exists.
 */
export async function getMemory(id: string): Promise<MemoryEntry | undefined> {
  const db = await getDB()
  return db.get(STORE_NAMES.MEMORIES, id)
}

/**
 * Persist a new memory entry.
 *
 * Auto-generates `id` (UUID), `createdAt`, and `updatedAt` timestamps.
 *
 * @returns The generated entry ID
 */
export async function saveMemory(
  memory: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const entry: MemoryEntry = {
    ...memory,
    id,
    createdAt: now,
    updatedAt: now,
  }

  const db = await getDB()
  await db.add(STORE_NAMES.MEMORIES, entry)
  return id
}

/**
 * Delete a memory entry by its ID.
 *
 * Silently succeeds if no entry exists with that ID.
 */
export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAMES.MEMORIES, id)
}
