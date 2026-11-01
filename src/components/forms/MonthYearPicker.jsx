/**
 * ============================================================================
 * MonthYearPicker — month + year selects (principle #3: structured dates)
 * ============================================================================
 * Value: 'YYYY-MM' or ''. Used for honor dates, activity start/end, education
 * graduation ("expected June 2027").
 * ============================================================================
 */
import { useId } from 'react'
import Field from './Field'
import './forms.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function MonthYearPicker({
  label,
  value = '',
  onChange,
  required = false,
  hint,
  fromYear = 2005,
  toYear = 2035,
  placeholderMonth = 'Month',
  placeholderYear = 'Year',
  allowFuture = true,
}) {
  const [yearPart, monthPart] = value ? value.split('-') : ['', '']
  const generatedId = useId()
  const years = []
  const endYear = allowFuture ? toYear : Math.min(toYear, new Date().getFullYear())
  for (let y = endYear; y >= fromYear; y--) years.push(y)

  return (
    <Field label={label} required={required} hint={hint}>
      {({ describedBy }) => (
        <div className="month-year" id={generatedId} aria-describedby={describedBy}>
          <select
            aria-label={`${label || 'Date'} — month`}
            value={monthPart || ''}
            onChange={(e) =>
              onChange?.(e.target.value && yearPart ? `${yearPart}-${e.target.value}` : '')
            }
            disabled={!yearPart && false}
          >
            <option value="">{placeholderMonth}</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select
            aria-label={`${label || 'Date'} — year`}
            value={yearPart || ''}
            onChange={(e) =>
              onChange?.(e.target.value && monthPart ? `${e.target.value}-${monthPart}` : '')
            }
          >
            <option value="">{placeholderYear}</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      )}
    </Field>
  )
}
