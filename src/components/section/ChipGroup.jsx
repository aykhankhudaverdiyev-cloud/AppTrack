/** ============================================================================
 * ChipGroup — separate chips with 8 px gaps, single- or multi-select.
 * Selected = solid purple with white text; unselected = white with grey border.
 * ============================================================================ */
import { useId } from 'react'

export default function ChipGroup({ label, value = [], onChange, options, name, singleSelect = false, required, disabled }) {
  const id = useId()
  const on = (key) => (singleSelect ? value === key : (value || []).includes(key))
  const toggle = (key) => {
    const next = singleSelect ? key : (on(key) ? (value || []).filter((k) => k !== key) : [...(value || []), key])
    onChange(next)
  }
  return (
    <fieldset className={`chip-group-field${!singleSelect && required ? ' chip-group--required' : ''}`}>
      {label && <legend className="field-label">{label}{required && <span className="field-req" aria-hidden="true"> *</span>}</legend>}
      <div className="chip-group" role={singleSelect ? 'radiogroup' : 'group'} aria-label={label}>
        {options.map((option) => {
          const itemId = `${id}-${option.value}`
          const active = on(option.value)
          return (
            <label key={option.value} className={`chip-group__item${active ? ' chip-group__item--on' : ''}`}>
              <input
                id={itemId}
                type={singleSelect ? 'radio' : 'checkbox'}
                name={name || id}
                value={option.value}
                checked={active}
                onChange={() => toggle(option.value)}
                disabled={disabled}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
