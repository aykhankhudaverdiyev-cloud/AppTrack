/** ============================================================================
 * TextAreaField — label row with copy icon + "x / limit" counter.
 * 4 px track under the textarea, fill green < 90 % / amber 90–100 %.
 * Typing beyond the limit is blocked; pasted text is truncated with a note.
 * ============================================================================ */
import { useRef, useState, useEffect } from 'react'

export default function TextAreaField({ label, value = '', max, onChange, onBlur, error, copyLabel }) {
  const ref = useRef(null)
  const [shortened, setShortened] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const length = value.length
  const percent = Math.min(100, max ? (length / max) * 100 : 0)
  const tone = percent >= 90 ? 'warn' : 'ok'

  const handle = (raw) => {
    if (raw.length > max) {
      setShortened(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setShortened(false), 3000)
      onChange(raw.slice(0, max))
      return
    }
    onChange(raw)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '')
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1400)
    } catch { setCopied(false) }
  }

  return (
    <div className={`textarea-field${error ? ' textarea-field--invalid' : ''}`}>
      <div className="label-row">
        <label className="field-label" htmlFor="textarea-field">{label}</label>
        <span className="counter" aria-live="polite">{length} / {max}</span>
      </div>
      <textarea
        id="textarea-field"
        ref={ref}
        className="textarea-field__input"
        value={value}
        rows={3}
        maxLength={max}
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
      />
      <div className={`textarea-field__track textarea-field__track--${tone}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      {shortened && <p className="field-hint textarea-field__hint-note" role="status">Pasted text was shortened to {max} characters.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button
        type="button"
        className="copy"
        onClick={copy}
        title={`Copy ${copyLabel || label}`}
        aria-label={`Copy ${copyLabel || label}`}
      >
        <span aria-hidden="true">⧉</span>
        {copied && <span className="copy__tip" role="status">Copied</span>}
      </button>
    </div>
  )
}
