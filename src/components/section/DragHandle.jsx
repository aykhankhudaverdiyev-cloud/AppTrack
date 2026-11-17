/** ============================================================================
 * DragHandle — six-dot grip (2 columns × 3 dots), 44 px touch target
 * Used as the @dnd-kit activator node; the section applies refs/attributes.
 * ============================================================================ */
export default function DragHandle({ 'aria-label': ariaLabel = 'Reorder', className = '' }) {
  return (
    <button
      type="button"
      className={`drag-handle${className ? ' ' + className : ''}`}
      aria-label={ariaLabel}
      aria-roledescription="drag handle"
    >
      <span className="drag-handle__dot" aria-hidden="true" />
      <span className="drag-handle__dot" aria-hidden="true" />
      <span className="drag-handle__dot" aria-hidden="true" />
      <span className="drag-handle__dot" aria-hidden="true" />
      <span className="drag-handle__dot" aria-hidden="true" />
      <span className="drag-handle__dot" aria-hidden="true" />
    </button>
  )
}
