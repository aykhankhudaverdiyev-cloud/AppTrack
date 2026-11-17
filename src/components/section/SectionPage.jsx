/** ============================================================================
 * SectionPage — white rounded container under the nav with a faint lavender
 * glow top-right: title, subtitle, primary gradient button top-right, a
 * filter-chip row and an optional right-aligned counter text.
 * ============================================================================ */
export default function SectionPage({ title, subtitle, action, chips, counter, children }) {
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h1 className="section__title">{title}</h1>
          {subtitle && <p className="section__sub">{subtitle}</p>}
        </div>
        {action && (
          <button type="button" className="section__action" onClick={action.onClick} disabled={action.disabled} title={action.title}>
            <span aria-hidden="true">＋</span> {action.label}
          </button>
        )}
      </header>

      {(chips || counter) && (
        <div className="section__toolbar">
          {chips}
          {counter && <span className="section__counter">{counter}</span>}
        </div>
      )}

      <div className="section__body">{children}</div>
    </section>
  )
}
