/**
 * ============================================================================
 * Field — accessible form field wrapper (principle #10)
 * ============================================================================
 * Renders label + control slot + hint + inline error. Every input in AppTrack
 * sits inside a Field so labels are always associated (htmlFor/id) and errors
 * are announced (aria-describedby, aria-invalid).
 *
 * <Field label="SAT Reading & Writing" error={err} hint="200–800, steps of 10">
 *   <input id={...} />
 * </Field>
 * ============================================================================
 */
import { useId } from 'react'
import './forms.css'
import { InlineError } from './PanelValidation'

/**
 * The shared control height for a text input: 44 px, 12–14 px padding, 15 px
 * text, 10 px radius. Every section input copies these numbers so one form
 * never looks different from the next.
 */
export const FIELD_INPUT_CLASS = 'field-input'

export default function Field({
  label,
  required = false,
  optional = false,
  error,
  hint,
  children,
  className = '',
  fieldKey,
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <div data-form-field={fieldKey} className={`field${error ? ' field-has-error' : ''} ${className}`.trim()}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="field-required" aria-hidden="true"> *</span>}
          {optional && <span className="field-optional"> (optional)</span>}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, describedBy: [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined, invalid: !!error })
        : children}
      {/* Both slots are always rendered: the field never jumps when an error
          appears, and a long hint may wrap without shifting the next row. */}
      <p className="field-hint" id={hintId} hidden={!hint}>{hint}</p>
      <div className="field-error-slot">
        <InlineError id={errorId} message={error} />
      </div>
    </div>
  )
}
