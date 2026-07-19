/**
 * Conversation store for managing transcript segments in IndexedDB.
 *
 * Each segment is stored as a separate entry in the 'conversations' object store
 * and indexed by personId for efficient lookup.
 */

import { getDB } from './db'
import { STORE_NAMES } from '@/lib/constants'
import type { ConversationSegment } from '@/types/index.d.ts'

/**
 * Retrieve all conversation segments for a given person,
 * ordered by timestamp ascending.
 */
export async function getConversationsByPerson(
  personId: string
): Promise<ConversationSegment[]> {
  const db = await getDB()
  const index = db.transaction(STORE_NAMES.CONVERSATIONS).store.index('timestamp')
  const all = await index.getAll()
  return all.filter((seg) => seg.personId === personId)
}

/**
 * Persist a single conversation segment to IndexedDB.
 */
export async function addConversationSegment(
  segment: ConversationSegment
): Promise<void> {
  const db = await getDB()
  await db.add(STORE_NAMES.CONVERSATIONS, segment)
}

/**
 * Persist multiple conversation segments in a single transaction.
 */
export async function addConversationSegments(
  segments: ConversationSegment[]
): Promise<void> {
  if (segments.length === 0) return

  const db = await getDB()
  const tx = db.transaction(STORE_NAMES.CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_NAMES.CONVERSATIONS)

  for (const segment of segments) {
    await store.add(segment)
  }

  await tx.done
}

/**
 * Delete a single conversation segment by ID.
 */
export async function deleteConversationSegment(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAMES.CONVERSATIONS, id)
}

/**
 * Delete all conversation segments for a given person.
 */
export async function deleteConversationsByPerson(
  personId: string
): Promise<void> {
  const segments = await getConversationsByPerson(personId)
  if (segments.length === 0) return

  const db = await getDB()
  const tx = db.transaction(STORE_NAMES.CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_NAMES.CONVERSATIONS)

  for (const seg of segments) {
    await store.delete(seg.id)
  }

  await tx.done
}
