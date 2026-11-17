/** ============================================================================
 * EmptyState — tiles, message, primary action
 * ============================================================================ */
export default function EmptyState({ tiles, title, description, onAdd, addLabel = 'Add' }) {
  return (
    <div className="aw-empty">
      {tiles && <div className="aw-empty__tiles" aria-hidden="true">{tiles}</div>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      <button type="button" className="aw-page__action" onClick={onAdd}>
        <span aria-hidden="true">＋</span> {addLabel}
      </button>
    </div>
  )
}
