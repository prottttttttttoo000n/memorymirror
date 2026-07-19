/**
 * Face data store for managing enrolled faces in IndexedDB.
 *
 * Provides CRUD operations for the 'faces' object store.
 * Embeddings are stored as number[] (IndexedDB structured clone limitation)
 * and converted to/from Float32Array at the API boundary.
 */

import { getDB } from './db'
import type { StoredFace } from './db'
import { STORE_NAMES } from '@/lib/constants'
import type { Person } from '@/types/index.d.ts'

// ── Re-export for consumers ───────────────────────────────────────

export type { StoredFace }

// ── Person store (existing — used by People tab) ──────────────────

export async function getAllPeople(): Promise<Person[]> {
  const db = await getDB()
  return db.getAll(STORE_NAMES.PEOPLE)
}

export async function getPerson(id: string): Promise<Person | undefined> {
  const db = await getDB()
  return db.get(STORE_NAMES.PEOPLE, id)
}

export async function addPerson(person: Person): Promise<void> {
  const db = await getDB()
  await db.add(STORE_NAMES.PEOPLE, person)
}

export async function updatePerson(person: Person): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAMES.PEOPLE, person)
}

export async function deletePerson(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAMES.PEOPLE, id)
}

export async function getPersonByName(name: string): Promise<Person | undefined> {
  const db = await getDB()
  const index = db.transaction(STORE_NAMES.PEOPLE).store.index('name')
  return index.get(name)
}

// ── Face enrollment store ─────────────────────────────────────────

/**
 * Saves a new enrolled face to IndexedDB.
 *
 * @param face - Face data without auto-generated fields
 * @returns The newly assigned face ID
 */
export async function saveFace(
  face: Omit<StoredFace, 'id' | 'createdAt' | 'updatedAt' | 'encounterCount' | 'lastSeenAt'>
): Promise<string> {
  const db = await getDB()
  const id = crypto.randomUUID()
  const now = Date.now()

  const stored: StoredFace = {
    ...face,
    id,
    createdAt: now,
    updatedAt: now,
    encounterCount: 1,
    lastSeenAt: now,
  }

  await db.add(STORE_NAMES.FACES, stored)
  return id
}

/** Returns all enrolled faces from IndexedDB. */
export async function getAllFaces(): Promise<StoredFace[]> {
  const db = await getDB()
  return db.getAll(STORE_NAMES.FACES)
}

/** Returns a single enrolled face by ID. */
export async function getFaceById(id: string): Promise<StoredFace | null> {
  const db = await getDB()
  const face = await db.get(STORE_NAMES.FACES, id)
  return face ?? null
}

/**
 * Updates select fields on an enrolled face.
 * Automatically bumps the `updatedAt` timestamp.
 */
export async function updateFace(
  id: string,
  updates: Partial<Pick<StoredFace, 'name' | 'thumbnail' | 'encounterCount' | 'lastSeenAt'>>
): Promise<void> {
  const db = await getDB()
  const existing = await db.get(STORE_NAMES.FACES, id)
  if (!existing) {
    console.warn(`[FaceStore] Face "${id}" not found for update`)
    return
  }

  await db.put(STORE_NAMES.FACES, {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  })
}

/** Deletes an enrolled face from IndexedDB. */
export async function deleteFace(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAMES.FACES, id)
}

/**
 * Loads all enrolled faces and converts their stored number[] embeddings
 * back to Float32Array for use with the face recognition service.
 */
export async function getAllEmbeddings(): Promise<
  Array<{ id: string; name: string; embedding: Float32Array }>
> {
  const db = await getDB()
  const faces = await db.getAll(STORE_NAMES.FACES)

  return faces.map((face) => ({
    id: face.id,
    name: face.name,
    embedding: new Float32Array(face.embedding),
  }))
}
