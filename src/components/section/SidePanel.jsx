/** ============================================================================
 * SidePanel — header (emoji tile · title · category dropdown tag · save
 * status · ×), sections with tiny uppercase labels, tip box at the bottom.
 * Sticky, scrolls internally. Top edge aligns with the first card.
 * ============================================================================ */
export default function SidePanel({
  tile, title, category, saveStatus, children, tip, onClose, className = '',
}) {
  const classes = [`side-panel${className ? ' ' + className : ''}`]
  return (
    <aside className={classes.join(' ')} role="region" aria-label={title} tabIndex={-1}>
      <header className="side-panel__head">
        {tile && <span className="side-panel__tile" aria-hidden="true">{tile}</span>}
        <h2 className="side-panel__title">{title}</h2>
        {category && <span className="side-panel__category">{category}</span>}
        {saveStatus && <span className="side-panel__save" role="status" aria-live="polite">{saveStatus}</span>}
        {onClose && (
          <button type="button" className="side-panel__close" onClick={onClose} aria-label="Close panel">
            <span aria-hidden="true">×</span>
          </button>
        )}
      </header>
      <div className="side-panel__body">{children}</div>
      {tip && <div className="side-panel__tip">{tip}</div>}
    </aside>
  )
}
