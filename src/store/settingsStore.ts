/**
 * Settings store — CRUD for AppSettings in IndexedDB.
 */

import { getDB } from './db'
import { STORE_NAMES, DEFAULT_SETTINGS } from '@/lib/constants'
import type { AppSettings } from '@/types/index.d.ts'

const SETTINGS_ID = 'app-settings'

/**
 * Retrieve app settings from IndexedDB.
 * Creates and returns defaults if no settings exist yet.
 */
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB()
  const settings = await db.get(STORE_NAMES.SETTINGS, SETTINGS_ID)
  if (!settings) {
    const defaults: AppSettings = {
      id: SETTINGS_ID,
      ...DEFAULT_SETTINGS,
    }
    await db.add(STORE_NAMES.SETTINGS, defaults)
    return defaults
  }
  return settings
}

/**
 * Persist (merge) app settings.
 * Only the provided fields are updated; existing fields are preserved.
 */
export async function saveSettings(
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  const db = await getDB()
  const existing = await db.get(STORE_NAMES.SETTINGS, SETTINGS_ID)
  const merged: AppSettings = {
    ...(existing ?? { id: SETTINGS_ID, ...DEFAULT_SETTINGS }),
    ...updates,
    id: SETTINGS_ID,
  }
  await db.put(STORE_NAMES.SETTINGS, merged)
  return merged
}

/**
 * Get approximate storage usage (count of memories, people, faces, conversations).
 */
export async function getStorageUsage(): Promise<{
  memories: number
  people: number
  faces: number
  conversations: number
}> {
  const db = await getDB()
  const tx = db.transaction([
    STORE_NAMES.MEMORIES,
    STORE_NAMES.PEOPLE,
    STORE_NAMES.FACES,
    STORE_NAMES.CONVERSATIONS,
  ], 'readonly')

  const [memories, people, faces, conversations] = await Promise.all([
    tx.objectStore(STORE_NAMES.MEMORIES).count(),
    tx.objectStore(STORE_NAMES.PEOPLE).count(),
    tx.objectStore(STORE_NAMES.FACES).count(),
    tx.objectStore(STORE_NAMES.CONVERSATIONS).count(),
  ])

  await tx.done
  return { memories, people, faces, conversations }
}
