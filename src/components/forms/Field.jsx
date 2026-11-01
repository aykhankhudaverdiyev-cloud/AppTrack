/**
 * ============================================================================
 * Field — accessible form field wrapper (principle #10)
 * ============================================================================
 * Renders label + control slot + hint + inline error. Every input in AppTrack
 * sits inside a Field so labels are always associated (htmlFor/id) and errors
 * are announced (aria-describedby, aria-invalid).
 *
 * <Field label="SAT Reading & Writing" error={err} hint="200–800, 10 addımla">
 *   <input id={...} />
 * </Field>
 * ============================================================================
 */
import { useId } from 'react'
import './forms.css'

export default function Field({
  label,
  required = false,
  optional = false,
  error,
  hint,
  children,
  className = '',
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <div className={`field${error ? ' field-has-error' : ''} ${className}`.trim()}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="field-required" aria-hidden="true"> *</span>}
          {optional && <span className="field-optional"> (məcburi deyil)</span>}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, describedBy: [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined, invalid: !!error })
        : children}
      {hint && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
    </div>
  )
}
