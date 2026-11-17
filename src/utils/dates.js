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
