import { Fragment } from 'react'
import './panelValidation.css'

export function InlineError({ id, message }) {
  if (!message) return null
  return <p className="panel-field-error" id={id} role="alert"><span aria-hidden="true">ⓘ</span> {message}</p>
}

export function ValidationSummary({ validation, className, completeClassName }) {
  const { submitted, requiredFields, invalidFields, focusField } = validation
  const remaining = requiredFields.filter(({ key }) => invalidFields[key])
  return (
    <p className={`${className}${remaining.length === 0 ? ` ${completeClassName}` : ''}`} aria-live="polite">
      {submitted && remaining.length > 0 ? <>
        {remaining.length} {remaining.length === 1 ? 'field' : 'fields'} left:{' '}
        {remaining.map(({ key, label }, index) => <Fragment key={key}>
          {index > 0 && ', '}
          <button className="panel-field-jump" type="button" onClick={() => focusField(key)}>{label}</button>
        </Fragment>)}
      </> : `${remaining.length === 0 ? '✓ ' : ''}${requiredFields.length - remaining.length} of ${requiredFields.length} required fields`}
    </p>
  )
}

export function NumericInput({ step, onKeyDown, onPaste, ...props }) {
  const decimal = step === 'any' || !Number.isInteger(Number(step ?? 1))
  return <input {...props} type="number" step={step} inputMode={props.inputMode ?? (decimal ? 'decimal' : 'numeric')}
    onKeyDown={(event) => {
      if (['e', 'E', '+', '-'].includes(event.key) || (!decimal && event.key === '.')) event.preventDefault()
      onKeyDown?.(event)
    }}
    onPaste={(event) => {
      const pasted = event.clipboardData.getData('text').trim()
      if (!(decimal ? /^(?:\d+(?:\.\d+)?|\.\d+)$/ : /^\d+$/).test(pasted)) event.preventDefault()
      onPaste?.(event)
    }} />
}
