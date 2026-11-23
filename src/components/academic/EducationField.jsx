/** ============================================================================
 * EducationField — label + control + hint + inline error for the Education panel
 * ============================================================================
 * Wraps the shared Field so every panel input gets an associated label, the
 * red required asterisk and announced errors, while keeping the panel's own
 * 40 px / 10 px-radius input styling (see EducationPanel.css).
 * ============================================================================ */

import { useId } from 'react'
import { InlineError } from '../forms/PanelValidation'

export default function EducationField({
  label, required = false, error, hint, children, className = '', fieldKey,
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const key = fieldKey || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : id)
  return (
    <div data-form-field={key} className={`edu-field${className ? ` ${className}` : ''}${error ? ' edu-field--error' : ''}`}>
      <label className="edu-label" htmlFor={id}>
        {label}{required && <span className="edu-req" aria-hidden="true">*</span>}
      </label>
      {typeof children === 'function'
        ? children({
          id,
          invalid: Boolean(error),
          describedBy: [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined,
        })
        : children}
      {hint && <p className="edu-helper" id={hintId}>{hint}</p>}
      <InlineError id={errorId} message={error} />
    </div>
  )
}

/** Input that shows a "42 / 80" counter and blocks typing past the maximum. */
export function CountedInput({ id, value, max, onChange, onBlur, invalid, placeholder }) {
  return (
    <div className="edu-counted">
      <input
        id={id} className="edu-input" value={value} maxLength={max} placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value.slice(0, max))}
        onBlur={onBlur}
      />
      <span className="edu-counted__count" aria-hidden="true">{String(value || '').length} / {max}</span>
    </div>
  )
}
