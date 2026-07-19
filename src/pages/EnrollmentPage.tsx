export function EnrollmentPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h2 style={styles.title}>Face Enrollment</h2>
        <p style={styles.description}>
          Enroll new people for face recognition. This feature will be available in Phase 1.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    color: 'var(--text-secondary)',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
}
