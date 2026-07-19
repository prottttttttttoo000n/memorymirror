import React, { useState, useEffect } from 'react'
import { ARViewPage } from '@/pages/ARViewPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PersonDetailPage } from '@/pages/PersonDetailPage'
import { PersonCard } from '@/components/PersonCard'
import { getAllPeople } from '@/store/faceStore'
import { getMemories } from '@/store/memoryStore'
import type { TabId, Person, MemoryEntry } from '@/types/index.d.ts'

// ── Tab definitions ─────────────────────────────────────────────────

interface TabDef {
  id: TabId
  label: string
  icon: React.JSX.Element
}

const tabs: TabDef[] = [
  {
    id: 'ar-view',
    label: 'AR View',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'people',
    label: 'People',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

// ── People page (inline) ────────────────────────────────────────────

function PeoplePage({
  onPersonClick,
}: {
  onPersonClick: (personId: string, personName: string) => void
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [memoryCounts, setMemoryCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const allPeople = await getAllPeople()
        if (cancelled) return
        setPeople(allPeople)

        // Count memories per person
        const counts: Record<string, number> = {}
        await Promise.all(
          allPeople.map(async (p) => {
            const mems = await getMemories(p.id)
            counts[p.id] = mems.length
          }),
        )
        if (!cancelled) {
          setMemoryCounts(counts)
        }
      } catch {
        // Silently handle — component will show empty state
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="people-page">
        <div className="page-header">
          <h2 className="page-header-title">People</h2>
        </div>
        <div className="people-loading">
          <div className="camera-spinner" />
          <p>Loading people...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="people-page">
      <div className="page-header">
        <h2 className="page-header-title">People</h2>
      </div>

      {people.length === 0 ? (
        <div className="people-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="people-empty-text">No people enrolled yet</p>
          <p className="people-empty-hint">
            Faces detected in AR view can be enrolled to appear here.
          </p>
        </div>
      ) : (
        <div className="people-list">
          {people.map((p) => (
            <PersonCard
              key={p.id}
              name={p.name}
              relationship={p.relationship}
              thumbnailUrl={p.thumbnailUrl}
              lastSeen={p.lastSeen}
              memoryCount={memoryCounts[p.id] ?? 0}
              onClick={() => onPersonClick(p.id, p.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── App component ───────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('ar-view')
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedPersonName, setSelectedPersonName] = useState<string>('')
  const [httpsWarning, setHttpsWarning] = useState(false)
  const [dbWarning, setDbWarning] = useState<string | null>(null)

  useEffect(() => {
    let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined
    import('virtual:pwa-register').then((mod) => {
      updateSW = mod.registerSW({
        onNeedRefresh() {
          setNeedsUpdate(true)
        },
        onOfflineReady() {
          console.log('App ready for offline use')
        },
      })
    })
  }, [])

  // Check for HTTPS (required for camera/mic)
  useEffect(() => {
    const isLocalhost =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]'
    if (location.protocol !== 'https:' && !isLocalhost) {
      setHttpsWarning(true)
    }
  }, [])

  // Check IndexedDB availability
  useEffect(() => {
    if (!('indexedDB' in window)) {
      setDbWarning('IndexedDB is not available in this browser. Data cannot be saved.')
      return
    }
    // Quick availability test
    try {
      const req = indexedDB.open('__mm_test__', 1)
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore('test')
        } catch {
          // Test store creation failed — may be private browsing
        }
      }
      req.onsuccess = () => {
        req.result.close()
        indexedDB.deleteDatabase('__mm_test__')
      }
      req.onerror = () => {
        setDbWarning('IndexedDB is not accessible. Data persistence may be limited.')
      }
    } catch {
      setDbWarning('IndexedDB is not accessible. Data persistence may be limited.')
    }
  }, [])

  const handlePersonClick = (personId: string, personName: string) => {
    setSelectedPersonId(personId)
    setSelectedPersonName(personName)
  }

  const handleMemoryClick = (memory: MemoryEntry) => {
    if (memory.personId) {
      handlePersonClick(memory.personId, '')
    }
  }

  const handleBackFromPersonDetail = () => {
    setSelectedPersonId(null)
    setSelectedPersonName('')
  }

  // If a person is selected, show PersonDetailPage instead of the tab content
  if (selectedPersonId) {
    return (
      <div style={styles.app}>
        <main style={styles.main}>
          <PersonDetailPage
            personId={selectedPersonId}
            onBack={handleBackFromPersonDetail}
          />
        </main>
      </div>
    )
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'ar-view':
        return <ARViewPage onPersonClick={handlePersonClick} />
      case 'timeline':
        return <TimelinePage onMemoryClick={handleMemoryClick} />
      case 'people':
        return <PeoplePage onPersonClick={handlePersonClick} />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    <div style={styles.app}>
      <main style={styles.main}>
        {renderPage()}
      </main>
      <nav style={styles.nav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {tab.icon}
            <span style={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
      {httpsWarning && (
        <div style={{ ...styles.warningBanner, background: 'var(--danger)' }}>
          <span>Camera and mic require HTTPS. Access via localhost or deploy with SSL.</span>
        </div>
      )}
      {dbWarning && (
        <div style={{ ...styles.warningBanner, background: 'var(--accent-secondary)' }}>
          <span>{dbWarning}</span>
        </div>
      )}
      {needsUpdate && (
        <div style={styles.updateBanner}>
          <span>Update available</span>
          <button onClick={() => window.location.reload()} style={styles.updateButton}>
            Reload
          </button>
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'var(--nav-height)',
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'var(--nav-height)',
    display: 'flex',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: 'var(--safe-bottom)',
    zIndex: 100,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '8px 0',
    minHeight: 44,
    fontSize: 10,
    transition: 'color 0.2s',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: 500,
  },
  updateBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: '8px 16px',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    zIndex: 200,
  },
  updateButton: {
    padding: '4px 12px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
  },
  warningBanner: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    padding: '8px 16px',
    color: '#fff',
    fontSize: 13,
    textAlign: 'center' as const,
    zIndex: 200,
    lineHeight: 1.4,
  },
}
