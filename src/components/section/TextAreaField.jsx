/** ============================================================================
 * TextAreaField — label row with copy icon + "x / limit" counter.
 * 4 px track under the textarea, fill green < 90 % / amber 90–100 %.
 * Typing beyond the limit is blocked; pasted text is truncated with a note.
 * ============================================================================ */
import { useId, useLayoutEffect, useRef, useState, useEffect } from 'react'
import { InlineError } from '../forms/PanelValidation'
import './section.css'

const MIN_ROWS = 3
const MAX_ROWS = 12
const LINE_HEIGHT = 22
const PADDING = 24

export default function TextAreaField({ label, value = '', max, onChange, onBlur, error, copyLabel, fieldKey }) {
  const id = useId()
  const ref = useRef(null)
  const [shortened, setShortened] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const length = value.length
  const percent = Math.min(100, max ? (length / max) * 100 : 0)
  const tone = percent >= 90 ? 'warn' : 'ok'

  // Grow with the text: 3 lines to start, 12 at most, then scroll.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    const min = MIN_ROWS * LINE_HEIGHT + PADDING
    const max = MAX_ROWS * LINE_HEIGHT + PADDING
    node.style.height = `${Math.min(max, Math.max(min, node.scrollHeight))}px`
    node.style.overflowY = node.scrollHeight > max ? 'auto' : 'hidden'
  }, [value])

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
    <div data-form-field={fieldKey} className={`textarea-field${error ? ' textarea-field--invalid' : ''}`}>
      <div className="label-row">
        <label className="sfield-label" htmlFor={id}>{label}</label>
        <span className="counter" aria-live="polite">{length} / {max}</span>
      </div>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        ref={ref}
        className="textarea-field__input"
        value={value}
        rows={MIN_ROWS}
        maxLength={max}
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
      />
      <div data-form-field={fieldKey} className={`textarea-field__track textarea-field__track--${tone}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      {shortened && <p className="sfield-hint textarea-field__hint-note" role="status">Pasted text was shortened to {max} characters.</p>}
      <InlineError id={`${id}-error`} message={error} />
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
