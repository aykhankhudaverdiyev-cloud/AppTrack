/** ============================================================================
 * EducationInputs — the country control of the Education panel
 * ============================================================================
 * CountrySelect — a native <select> styled as an input with a small "▾", so
 * labels, keyboard and screen readers behave exactly as they do everywhere
 * else in the app.
 *
 * Dates are not here any more: the Education panel uses the shared DatePicker
 * (section/DatePicker.jsx), so every section has one date control.
 * ============================================================================ */

export function CountrySelect({ id, value, onChange, onBlur, options = [], invalid }) {
  return (
    <div className="edu-select">
      <select
        id={id} className={`edu-input${value ? '' : ' edu-input--placeholder'}${invalid ? ' edu-input--invalid' : ''}`}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      >
        <option value="">Select country</option>
        {options.map((country) => (
          <option key={country.key} value={country.label}>{country.label}</option>
        ))}
        {value && !options.some((country) => country.label === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
      <span className="edu-select__caret" aria-hidden="true">▾</span>
    </div>
  )
}

/**
 * CountrySelect is the only control left here: dates now use the shared
 * DatePicker (src/components/section/DatePicker.jsx), so every section has one
 * date control with the same typing, clear button and popover behaviour.
 */
