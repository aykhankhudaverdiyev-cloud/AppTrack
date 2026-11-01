/**
 * ============================================================================
 * timezone.js — Deadline time-zone utilities (core principle #5)
 * ============================================================================
 *
 * WHY: HKU deadlines are 12:00 Hong Kong time, NTU 16:00 Taiwan time, US
 * schools usually 23:59 local time. Students miss deadlines by converting
 * manually. Every deadline is stored as:
 *      { due_at: timestamptz, original_timezone: 'Asia/Hong_Kong' }
 * and displayed in the student's local zone WITH the original time next to it.
 *
 * Zero dependencies — built on the standard Intl API (full ICU).
 * ============================================================================
 */

/**
 * Offset (milliseconds) of a time zone at a given instant.
 * Positive = west of UTC (e.g. America/New_York winter: +5h → 18000000).
 * @param {string} timeZone IANA name, e.g. 'Asia/Baku'
 * @param {Date} date instant at which to evaluate the offset
 * @returns {number} milliseconds
 */
export function getTimeZoneOffsetMs(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  )
  return asUTC - date.getTime()
}

/**
 * Convert a wall-clock time in a specific zone to the exact UTC instant.
 * @param {string} dateStr 'YYYY-MM-DD' (the date as shown on the university page)
 * @param {string} timeStr 'HH:mm' 24h
 * @param {string} timeZone IANA name of the ORIGINAL zone
 * @returns {Date}
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm)
  // Two-pass: resolve the offset at the guessed instant, then re-resolve at
  // the corrected instant (handles DST edges).
  let offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess))
  offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess - offset))
  return new Date(utcGuess - offset)
}

/**
 * Wall-clock parts of an instant as seen in a time zone.
 * @returns {{year,month,day,hour,minute,weekday}}
 */
export function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: parts.weekday,
  }
}

/**
 * Human-readable format of an instant in a zone.
 * @param {Date} date
 * @param {string} timeZone
 * @param {string} [locale] BCP-47, defaults to British English
 * @returns {string} e.g. "5 January, 08:00"
 */
export function formatInTimeZone(date, timeZone, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * Full date format (used for calendar views).
 * e.g. "05.01.2027, 08:00"
 */
export function formatFullInTimeZone(date, timeZone, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * GMT-offset label of a zone at an instant, e.g. 'GMT+8' / 'GMT-5'.
 */
export function zoneOffsetLabel(timeZone, date) {
  const minutes = Math.round(getTimeZoneOffsetMs(timeZone, date) / 60000)
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return `GMT${sign}${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''}`
}

/**
 * The zone to display for the student: profile value → device zone → UTC.
 * @param {string} [profileTimeZone]
 * @returns {string} IANA name
 */
export function getStudentTimeZone(profileTimeZone) {
  if (profileTimeZone) return profileTimeZone
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Countdown parts until a target instant.
 * @param {Date} target
 * @param {Date} [now]
 * @returns {{days:number,hours:number,minutes:number,totalMs:number,isPast:boolean}}
 */
export function countdownParts(target, now = new Date()) {
  const totalMs = target.getTime() - now.getTime()
  const abs = Math.max(0, totalMs)
  const minutes = Math.floor(abs / 60000)
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    totalMs,
    isPast: totalMs < 0,
  }
}

/**
 * Countdown in words: "3 days 4 hours left".
 * Only the two most significant non-zero units are shown.
 */
export function formatCountdown(target, now = new Date()) {
  const c = countdownParts(target, now)
  if (c.isPast) return 'deadline passed'
  const units = [
    [c.days, c.days === 1 ? 'day' : 'days'],
    [c.hours, c.hours === 1 ? 'hour' : 'hours'],
    [c.minutes, c.minutes === 1 ? 'minute' : 'minutes'],
  ]
  const shown = units.filter(([v]) => v > 0).slice(0, 2)
  if (shown.length === 0) return 'due now'
  return shown.map(([v, label]) => `${v} ${label}`).join(' ') + ' left'
}

/**
 * Everything the UI needs for one deadline row/card.
 * @param {{dueAt: Date, originalTimeZone: string, label?: string}} deadline
 * @param {string} studentTz
 * @param {Date} [now]
 * @returns {{originalText: string, localText: string, countdownText: string,
 *            isPast: boolean, dayShift: number, isUrgent: boolean}}
 *   dayShift — how many days the local date differs from the original date
 *              (US 23:59 → next morning in Baku = 1; HK → same day = 0).
 */
export function describeDeadline(deadline, studentTz, now = new Date()) {
  const { dueAt, originalTimeZone } = deadline
  const orig = getZonedParts(dueAt, originalTimeZone)
  const local = getZonedParts(dueAt, studentTz)
  const origDateOnly = Date.UTC(orig.year, orig.month - 1, orig.day)
  const localDateOnly = Date.UTC(local.year, local.month - 1, local.day)
  const dayShift = Math.round((localDateOnly - origDateOnly) / 86400000)
  const countdown = countdownParts(dueAt, now)
  return {
    originalText: `${formatInTimeZone(dueAt, originalTimeZone)} (${zoneOffsetLabel(originalTimeZone, dueAt)})`,
    localText: formatInTimeZone(dueAt, studentTz),
    countdownText: formatCountdown(dueAt, now),
    isPast: countdown.isPast,
    dayShift,
    isUrgent: !countdown.isPast && countdown.totalMs <= 3 * 86400000,
  }
}

/**
 * Reminder instants: 30/14/7/3/1 days and day-of (core principle for
 * Section 15). Past instants are skipped.
 * @returns {Date[]}
 */
export function suggestReminderTimes(dueAt, now = new Date()) {
  return [30, 14, 7, 3, 1, 0]
    .map((days) => new Date(dueAt.getTime() - days * 86400000))
    .filter((t) => t.getTime() > now.getTime())
}
