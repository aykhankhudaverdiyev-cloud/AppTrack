/** ============================================================================
 * SegmentedControl — radio group. Fills its column width.
 * Selected = solid purple #6D5BF0 with white text.
 * ============================================================================ */
import { InlineError } from '../forms/PanelValidation'
import { useId } from 'react'

export default function SegmentedControl({ label, value, onChange, options, name, required, error, fieldKey }) {
  const id = useId()
  return (
    <fieldset data-form-field={fieldKey} aria-invalid={error ? true : undefined} className="segmented-field">
      <legend className="sfield-label">{label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}</legend>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const itemId = `${id}-${option.value}`
          return (
            <label key={option.value} className={`segmented__item${value === option.value ? ' segmented__item--on' : ''}`}>
              <input
                id={itemId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      <InlineError message={error} />
    </fieldset>
  )
}
