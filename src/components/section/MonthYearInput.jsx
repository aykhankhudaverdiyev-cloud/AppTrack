/** ============================================================================
 * MonthYearInput — month + year picker. Stored as YYYY-MM (the 1st of the
 * month), displayed in inputs as MM/YYYY while typing.
 * ============================================================================ */
import { useId, useRef, useState, useEffect } from 'react'
import { parseMonthInput, formatMonthInput } from '../../utils/dates.js'

export default function MonthYearInput({ label, value = '', onChange, onBlur, required, error }) {
  const id = useId()
  const [text, setText] = useState(() => formatMonthInput(value))
  const lastValue = useRef(value)

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      setText(formatMonthInput(value))
    }
  }, [value])

  const handle = (raw) => {
    setText(raw)
    const parsed = parseMonthInput(raw)
    if (parsed || raw.trim() === '') {
      lastValue.current = parsed
      onChange(parsed)
    }
  }

  const invalid = text.trim() !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(text)

  return (
    <div className={`month-field${error || invalid ? ' month-field--invalid' : ''}`}>
      <label className="field-label">{label}{required && <span className="field-req" aria-hidden="true"> *</span>}</label>
      <input
        id={id}
        className="month-field__input"
        value={text}
        placeholder="MM/YYYY"
        inputMode="numeric"
        maxLength={7}
        aria-invalid={error || invalid ? 'true' : undefined}
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
      />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
