/** ============================================================================
 * dates.js — the one date-display helper used by every section
 * ============================================================================
 * Display rule (spec §1.2):
 *   month precision → "Jun 2025"
 *   day precision   → "11 Apr 2026"
 * Never render numeric "06/2025" / "11/04/2026" in display text. Inputs may
 * still accept typing; inputs keep their own MM/YYYY or date pickers.
 * ============================================================================ */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/
const DAY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function parts(value) {
  const text = String(value || '').trim()
  if (DAY_PATTERN.test(text)) {
    const [, year, month, day] = DAY_PATTERN.exec(text)
    return { year: Number(year), month: Number(month), day: Number(day) }
  }
  if (MONTH_PATTERN.test(text)) {
    const [, year, month] = MONTH_PATTERN.exec(text)
    return { year: Number(year), month: Number(month), day: null }
  }
  return null
}

/**
 * '2025-06'            → "Jun 2025"   (precision 'month')
 * '2026-04-11'        → "11 Apr 2026" (precision 'day')
 * Falls back to the raw string when it cannot be parsed.
 */
export function formatDate(value, precision = 'month') {
  const p = parts(value)
  if (!p) return String(value || '')
  const name = MONTHS[p.month - 1]
  if (precision === 'day' && p.day) return `${p.day} ${name} ${p.year}`
  return `${name} ${p.year}`
}

/** '2025-06' → "06/2025" for an input placeholder. '' when unset/invalid. */
export function formatMonthInput(value) {
  const p = parts(value)
  if (!p || !p.month) return ''
  return `${String(p.month).padStart(2, '0')}/${p.year}`
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const padded = (value) => String(value).padStart(2, '0')

/**
 * What a student types into a month field → 'YYYY-MM-DD' (the first day of the
 * month), or '' when it is not a month.
 *   "09/2023" · "9-2023" · "Sep 2023" · "september 2023" · "2023-09"
 */
export function parseTypedMonth(input) {
  const raw = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!raw) return ''
  const slashed = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(raw)
  if (slashed) {
    const month = Number(slashed[1])
    return month >= 1 && month <= 12 ? `${slashed[2]}-${padded(month)}-01` : ''
  }
  const iso = /^(\d{4})[-/](\d{1,2})$/.exec(raw)
  if (iso) {
    const month = Number(iso[2])
    return month >= 1 && month <= 12 ? `${iso[1]}-${padded(month)}-01` : ''
  }
  const named = /^([a-z]+)\.?,?\s*(\d{4})$/.exec(raw)
  if (!named) return ''
  const index = MONTH_NAMES.indexOf(named[1].slice(0, 3))
  return index === -1 ? '' : `${named[2]}-${padded(index + 1)}-01`
}

/**
 * What a student types into a date field → 'YYYY-MM-DD', or '' when it is not
 * a date.
 *   "12 Sep 2023" · "12/09/2023" · "2023-09-12"
 */
export function parseTypedDay(input) {
  const raw = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (iso) return `${iso[1]}-${padded(iso[2])}-${padded(iso[3])}`
  const slashed = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(raw)
  if (slashed) return `${slashed[3]}-${padded(slashed[2])}-${padded(slashed[1])}`
  const named = /^(\d{1,2})\.?\s+([a-z]+)\.?,?\s+(\d{4})$/.exec(raw)
  if (named) {
    const index = MONTH_NAMES.indexOf(named[2].slice(0, 3))
    return index === -1 ? '' : `${named[3]}-${padded(index + 1)}-${padded(named[1])}`
  }
  return ''
}

/** '06/2025' → '2025-06'; '' when empty or invalid. */
export function parseMonthInput(input) {
  const text = String(input || '').trim().replace(/\s+/g, '')
  const match = /^(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) return ''
  const month = Number(match[1])
  if (month < 1 || month > 12) return ''
  return `${match[2]}-${String(month).padStart(2, '0')}`
}

/** '2025-06-01' → '2025-06'; '2025-06' → '2025-06-01' */
export function dateToMonth(date) {
  const p = parts(date)
  return p && p.month ? `${p.year}-${String(p.month).padStart(2, '0')}` : ''
}
export function monthToDate(month) {
  const p = parts(month)
  return p && p.month ? `${p.year}-${String(p.month).padStart(2, '0')}-01` : null
}
