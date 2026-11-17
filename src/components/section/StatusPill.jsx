/** ============================================================================
 * StatusPill — Complete (green ✓) / Missing (amber) / Draft (grey),
 * plus test statuses (Planned / Registered / Waiting for scores / Released)
 * and the purple-outlined ★ Best pill. Never colour alone — always text.
 * ============================================================================ */
export default function StatusPill({ variant, label, dot, className = '' }) {
  const base = `status-pill${className ? ' ' + className : ''}`
  if (variant === 'best') {
    return (
      <span className={`${base} status-pill--best`} role="status" aria-label={label}>
        <span aria-hidden="true">★</span>{' '}{label}
      </span>
    )
  }
  const tone = `status-pill--${variant || 'draft'}`
  return (
    <span className={`${base} ${tone}`} role="status" aria-label={label}>
      {dot && <span className="status-pill__dot" aria-hidden="true" />}
      {label}
    </span>
  )
}
