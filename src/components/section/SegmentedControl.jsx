/** ============================================================================
 * SegmentedControl — radio group. Fills its column width.
 * Selected = solid purple #6D5BF0 with white text.
 * ============================================================================ */
import { useId } from 'react'

export default function SegmentedControl({ label, value, onChange, options, name }) {
  const id = useId()
  return (
    <fieldset className="segmented-field">
      <legend className="field-label">{label}</legend>
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
    </fieldset>
  )
}
