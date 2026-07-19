import { openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, STORE_NAMES } from '@/lib/constants'
import type { MemoryEntry, Person, AppSettings, ConversationSegment } from '@/types/index.d.ts'

let dbInstance: IDBPDatabase<MemoryMirrorDB> | null = null

/** Face record stored in the 'faces' object store. */
export interface StoredFace {
  id: string
  name: string
  /** Float32Array serialized to number[] for IndexedDB compatibility */
  embedding: number[]
  /** Data URL of the face crop thumbnail */
  thumbnail: string
  createdAt: number
  updatedAt: number
  encounterCount: number
  lastSeenAt: number
}

interface MemoryMirrorDB {
  [STORE_NAMES.MEMORIES]: MemoryEntry
  [STORE_NAMES.PEOPLE]: Person
  [STORE_NAMES.SETTINGS]: AppSettings
  [STORE_NAMES.CONVERSATIONS]: ConversationSegment
  [STORE_NAMES.FACES]: StoredFace
}

export async function getDB(): Promise<IDBPDatabase<MemoryMirrorDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<MemoryMirrorDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAMES.MEMORIES)) {
        const store = db.createObjectStore(STORE_NAMES.MEMORIES, {
          keyPath: 'id',
        })
        store.createIndex('personId', 'personId', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.PEOPLE)) {
        const store = db.createObjectStore(STORE_NAMES.PEOPLE, {
          keyPath: 'id',
        })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('lastSeen', 'lastSeen', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
        db.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.CONVERSATIONS)) {
        const store = db.createObjectStore(STORE_NAMES.CONVERSATIONS, {
          keyPath: 'id',
        })
        store.createIndex('personId', 'personId', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.FACES)) {
        const store = db.createObjectStore(STORE_NAMES.FACES, {
          keyPath: 'id',
        })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('lastSeenAt', 'lastSeenAt', { unique: false })
      }
    },
  })

  return dbInstance
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
