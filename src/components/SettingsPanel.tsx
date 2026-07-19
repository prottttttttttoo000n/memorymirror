// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SettingsPanelProps {}

export function SettingsPanel(_props: SettingsPanelProps) {
  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Appearance</h3>
        <div style={styles.row}>
          <span>Theme</span>
          <span style={styles.value}>Dark</span>
        </div>
        <div style={styles.row}>
          <span>Font Size</span>
          <span style={styles.value}>Normal</span>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recognition</h3>
        <div style={styles.row}>
          <span>Face Recognition</span>
          <span style={styles.value}>Enabled</span>
        </div>
        <div style={styles.row}>
          <span>Speech-to-Text</span>
          <span style={styles.value}>Enabled</span>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>About</h3>
        <div style={styles.row}>
          <span>Version</span>
          <span style={styles.value}>0.1.0</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  section: {
    background: 'var(--bg-card)',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: 14,
    minHeight: 44,
  },
  value: {
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
}
