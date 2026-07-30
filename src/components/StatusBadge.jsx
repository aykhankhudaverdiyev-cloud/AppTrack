export default function StatusBadge({ children, variant = 'default' }) {
  return <span className={`status-badge status-badge--${variant}`}>{children}</span>
}