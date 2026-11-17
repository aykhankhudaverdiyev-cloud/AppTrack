/** ============================================================================
 * NumberWithSuffix — number input with a grey suffix inside the input
 * ("/ 9", "/ 1600").
 * ============================================================================ */
export default function NumberWithSuffix({ label, value = '', suffix, onChange, onBlur, error, min, max, required }) {
  return (
    <div className={`number-field${error ? ' number-field--invalid' : ''}`}>
      <label className="sfield-label">{label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}</label>
      <div className="number-input-wrap">
        <input
          className={`number-input${error ? ' number-input--invalid' : ''}`}
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        {suffix && <span className="number-suffix">{suffix}</span>}
      </div>
      {error && <p className="sfield-error" role="alert">{error}</p>}
    </div>
  )
}
