/**
 * High-level memory database operations.
 * Combines IndexedDB access with business logic.
 */

import { getDB } from '@/store/db'
import { STORE_NAMES } from '@/lib/constants'
import type { MemoryEntry, ConversationSegment } from '@/types/index.d.ts'

export async function getRecentMemories(limit = 20): Promise<MemoryEntry[]> {
  const db = await getDB()
  const index = db.transaction(STORE_NAMES.MEMORIES).store.index('timestamp')
  const all = await index.getAll()
  return all.reverse().slice(0, limit)
}

export async function getConversationHistory(
  personId: string,
  limit = 50
): Promise<ConversationSegment[]> {
  const db = await getDB()
  const index = db.transaction(STORE_NAMES.CONVERSATIONS).store.index('personId')
  const all = await index.getAll(personId)
  return all.reverse().slice(0, limit)
}

export async function saveConversationSegment(
  segment: ConversationSegment
): Promise<void> {
  const db = await getDB()
  await db.add('conversations', segment)
}
