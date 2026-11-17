/** ============================================================================
 * SectionPage — white rounded container under the nav with a faint lavender
 * glow top-right: title, subtitle, primary gradient button top-right, a
 * filter-chip row and an optional right-aligned counter text.
 * ============================================================================ */
import './section.css'

export default function SectionPage({ title, subtitle, action, chips, counter, children }) {
  return (
    <section className="aw-page">
      <header className="aw-page__head">
        <div>
          <h1 className="aw-page__title">{title}</h1>
          {subtitle && <p className="aw-page__sub">{subtitle}</p>}
        </div>
        {action && (
          <button type="button" className="aw-page__action" onClick={action.onClick} disabled={action.disabled} title={action.title}>
            <span aria-hidden="true">＋</span> {action.label}
          </button>
        )}
      </header>

      {(chips || counter) && (
        <div className="aw-page__toolbar">
          {chips}
          {counter && <span className="aw-page__counter">{counter}</span>}
        </div>
      )}

      <div className="aw-page__body">{children}</div>
    </section>
  )
}
