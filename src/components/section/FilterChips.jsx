/** ============================================================================
 * FilterChips — "Label n" chips with a small count badge.
 * Selected = solid purple with white text.
 * A chip renders only when its count > 0, or when it is the selected one.
 * ============================================================================ */
export default function FilterChips({ items, value, onChange, total, groupLabel }) {
  return (
    <div className="section-chips" role="group" aria-label={groupLabel || 'Filter'}>
      <button
        type="button"
        className={`section-chip${value === 'all' ? ' section-chip--on' : ''}`}
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        All <span className="section-chip__n">{total ?? items.reduce((sum, item) => sum + item.count, 0)}</span>
      </button>
      {items.filter((item) => item.count > 0 || item.key === value).map((item) => (
        <button
          key={item.key}
          type="button"
          className={`section-chip${value === item.key ? ' section-chip--on' : ''}`}
          aria-pressed={value === item.key}
          onClick={() => onChange(item.key)}
        >
          {item.label} <span className="section-chip__n">{item.count}</span>
        </button>
      ))}
    </div>
  )
}
