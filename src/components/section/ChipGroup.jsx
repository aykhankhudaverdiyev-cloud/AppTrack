/** ============================================================================
 * ChipGroup — separate chips with 8 px gaps, single- or multi-select.
 * Selected = solid purple with white text; unselected = white with grey border.
 * Chips are real <button>s (never a hidden native radio/checkbox), so Click,
 * Space and Enter all toggle them, and a single-select chip clears itself when
 * clicked again — something a native <input type="radio"> cannot do.
 * ============================================================================ */
export default function ChipGroup({
  label, value = [], onChange, options, singleSelect = false, required, disabled, helper,
}) {
  const on = (key) => (singleSelect ? value === key : (value || []).includes(key))
  const toggle = (key) => {
    if (disabled) return
    if (singleSelect) {
      onChange(value === key ? null : key)
      return
    }
    onChange(on(key) ? (value || []).filter((k) => k !== key) : [...(value || []), key])
  }
  const handleKeyDown = (key) => (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      toggle(key)
    }
  }
  return (
    <fieldset className={`chip-group-field${!singleSelect && required ? ' chip-group--required' : ''}`}>
      {label && <legend className="sfield-label">{label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}</legend>}
      <div className="chip-group" role={singleSelect ? 'radiogroup' : 'group'} aria-label={label}>
        {options.map((option) => {
          const active = on(option.value)
          return (
            <button
              key={option.value}
              type="button"
              className={`chip-group__item${active ? ' chip-group__item--on' : ''}`}
              role={singleSelect ? 'radio' : 'checkbox'}
              aria-checked={active}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              onClick={() => toggle(option.value)}
              onKeyDown={handleKeyDown(option.value)}
            >
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
      {helper && <p className="sfield-hint">{helper}</p>}
    </fieldset>
  )
}
