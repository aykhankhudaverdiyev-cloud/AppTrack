/**
 * ============================================================================
 * ValidatedInput — text/number/select inputs with inline validation (principle #9)
 * ============================================================================
 * Rule = explanation. Every validator returns an error STRING that is shown
 * verbatim ("SAT section scores are 200–800 in steps of 10"), so the student
 * learns the rule instead of just seeing red.
 *
 * <ValidatedInput
 *   label="Reading & Writing"
 *   type="number" min={200} max={800} step={10}
 *   validate={(v) => (v == null || (v >= 200 && v <= 800 && v % 10 === 0)
 *     ? '' : 'SAT section scores are 200-800 in steps of 10')}
 *   value={v} onChange={setV}
 * />
 * ============================================================================
 */
import { useState } from 'react'
import Field from './Field'
import CharWordCounter from './CharWordCounter'
import './forms.css'

function runValidation(value, validate, required) {
  const empty = value === '' || value === null || value === undefined
  if (required && empty) return 'This field is required'
  if (empty && !required) return ''
  if (typeof validate === 'function') return validate(value) || ''
  return ''
}

export function ValidatedInput({
  label,
  type = 'text',
  value,
  onChange,
  validate,
  required = false,
  hint,
  placeholder,
  prefix,
  suffix,
  showCounter = false,
  maxLength,
  disabled = false,
  inputMode,
  autoComplete = 'off',
}) {
  const [touched, setTouched] = useState(false)
  const error = touched ? runValidation(value, validate, required) : ''

  return (
    <Field label={label} required={required} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <>
          <div className="field-control">
            {prefix && <span className="field-prefix">{prefix}</span>}
            <input
              id={id}
              type={type}
              value={value ?? ''}
              onChange={(e) => {
                const next = type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                onChange?.(next)
              }}
              onBlur={() => setTouched(true)}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              inputMode={inputMode}
              autoComplete={autoComplete}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
            {suffix && <span className="field-suffix">{suffix}</span>}
          </div>
          {showCounter && (
            <CharWordCounter value={typeof value === 'string' ? value : ''} maxChars={maxLength} compact />
          )}
        </>
      )}
    </Field>
  )
}

export function ValidatedSelect({
  label,
  value,
  onChange,
  options = [],
  validate,
  required = false,
  hint,
  placeholder = 'Select...',
  disabled = false,
}) {
  const [touched, setTouched] = useState(false)
  const error = touched ? runValidation(value, validate, required) : ''

  return (
    <Field label={label} required={required} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value || null)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => {
            const key = typeof opt === 'string' ? opt : opt.key
            const text = typeof opt === 'string' ? opt : opt.label
            return (
              <option key={key} value={key}>
                {text}
              </option>
            )
          })}
        </select>
      )}
    </Field>
  )
}
