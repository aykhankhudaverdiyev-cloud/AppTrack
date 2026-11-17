/** ============================================================================
 * EmptyState — tiles, message, primary action
 * ============================================================================ */
export default function EmptyState({ tiles, title, description, onAdd, addLabel = 'Add' }) {
  return (
    <div className="empty-state">
      {tiles && <div className="empty-state__tiles" aria-hidden="true">{tiles}</div>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      <button type="button" className="section__action" onClick={onAdd}>
        <span aria-hidden="true">＋</span> {addLabel}
      </button>
    </div>
  )
}
