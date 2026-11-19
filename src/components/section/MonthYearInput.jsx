/** ============================================================================
 * MonthYearInput — month + year picker. Stored as YYYY-MM (the 1st of the
 * month), displayed in inputs as MM/YYYY while typing.
 * ============================================================================ */
import { useId, useRef, useState, useEffect } from 'react'
import { InlineError, MONTH_INPUT_PATTERN } from '../forms/PanelValidation'
import { parseMonthInput, formatMonthInput } from '../../utils/dates.js'

export default function MonthYearInput({ label, value = '', onChange, onBlur, required, error, fieldKey }) {
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

  return (
    <div data-form-field={fieldKey} className={`month-field${error ? ' month-field--invalid' : ''}`}>
      <label className="sfield-label" htmlFor={id}>{label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}</label>
      <input
        id={id}
        className="month-field__input"
        value={text}
        placeholder="MM/YYYY"
        inputMode="numeric"
        maxLength={7}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        pattern={MONTH_INPUT_PATTERN}
        data-validation-message="Use MM/YYYY"
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
      />
      <InlineError id={`${id}-error`} message={error} />
    </div>
  )
}
