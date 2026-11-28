/** ============================================================================
 * DatePicker — the one date control used by every section
 * ============================================================================
 * mode="month"  → "Sep 2023"   (education, activities, honors, projects)
 * mode="day"    → "12 Sep 2023" (test dates, deadlines)
 *
 * The value is a plain text field, so a student can either pick a month from
 * the grid or type "09/2023" / "Sep 2023" / "2023-09". While the field has
 * focus it owns its text (a re-render never rewrites what was typed); on blur
 * it snaps back to the stored value. A month is stored as the first day of that
 * month, so a month pick always displays after reloading.
 *
 * The popover is portalled and positioned against the viewport: it flips above
 * the field when there is no room below and never gets clipped by a panel's
 * `overflow: hidden`. Escape / outside click closes it, arrows move between
 * cells, Enter picks, and ✕ clears the field.
 * ============================================================================ */

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { formatDate, parseTypedDay, parseTypedMonth } from '../../utils/dates'
import { InlineError } from '../forms/PanelValidation'
import './section.css'

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const pad = (value) => String(value).padStart(2, '0')
const isoMonth = (year, month) => `${year}-${pad(month)}`
const isoDay = (year, month, day) => `${isoMonth(year, month)}-${pad(day)}`
const labelFor = (value, dayMode) => (value ? formatDate(value, dayMode ? 'day' : 'month') : '')

/** Where the popover goes: below the field, or above when there is no room. */
function placePopover(trigger, height) {
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(324, window.innerWidth - 16)
  const below = window.innerHeight - rect.bottom - 14
  const above = rect.top - 14
  const flip = below < height && above > below
  return {
    width,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    maxHeight: Math.max(120, flip ? above : below),
    ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
  }
}

export default function DatePicker({
  label, mode = 'month', value = '', onChange, required, error, fieldKey,
  allowFuture = true, disabled = false, hint, min, max, onBlur,
}) {
  const id = useId()
  const trigger = useRef(null)
  const popup = useRef(null)
  const [position, setPosition] = useState(null)
  const [draft, setDraft] = useState(null)
  const [draftError, setDraftError] = useState('')
  const [year, setYear] = useState(() => Number(String(value || new Date().toISOString()).slice(0, 4)))
  const [month, setMonth] = useState(() => Number(String(value || new Date().toISOString()).slice(5, 7)) || 1)
  const now = new Date()
  const today = isoDay(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const dayMode = mode === 'day'
  const open = Boolean(position)
  const shown = draft ?? labelFor(value, dayMode)

  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setPosition(null)
    }
    const close = () => setPosition(null)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    const element = popup.current
    const active = element?.querySelector('[aria-pressed="true"]:not(:disabled)')
      || element?.querySelector('.date-picker__cell:not(:disabled)')
    active?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const toggle = () => {
    if (disabled) return
    if (open) { setPosition(null); return }
    const source = value || today
    setYear(Number(source.slice(0, 4)))
    setMonth(Number(source.slice(5, 7)) || 1)
    setPosition(placePopover(trigger.current, dayMode ? 372 : 300))
  }
  const close = () => { setPosition(null) }
  const inRange = (next) => {
    const precision = dayMode ? 10 : 7
    const candidate = next.slice(0, precision)
    return (!min || candidate >= min.slice(0, precision)) && (!max || candidate <= max.slice(0, precision)) && (allowFuture || candidate <= today.slice(0, precision))
  }
  const select = (next) => {
    if (next && !inRange(next)) return
    setDraft(null); setDraftError(''); trigger.current?.setCustomValidity('')
    flushSync(() => onChange(next))
    close()
    onBlur?.(next)
    trigger.current?.focus({ preventScroll: true })
  }
  const moveMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  const keyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (!event.target.matches?.('.date-picker__cell')) return
    if (event.key === 'Enter') { event.preventDefault(); event.target.click(); return }
    const columns = dayMode ? 7 : 3
    const distance = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key]
    if (!distance) return
    event.preventDefault()
    const cells = [...(popup.current?.querySelectorAll('.date-picker__cell:not(:disabled)') || [])]
    const next = cells[cells.indexOf(event.target) + distance]
    next?.focus({ preventScroll: true })
    if (next) next.scrollIntoView({ block: 'nearest' })
  }

  const commitDraft = () => {
    if (draft === null) return
    const raw = draft.trim()
    const parsed = raw ? (dayMode ? parseTypedDay(raw) : parseTypedMonth(raw)) : ''
    const validDay = !dayMode || !parsed || (() => {
      const [y, m, d] = parsed.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    })()
    const message = raw && (!parsed || !validDay) ? 'Enter a valid date.' : parsed && !inRange(parsed) ? 'Date must be within the allowed range.' : ''
    trigger.current?.setCustomValidity(message)
    if (message) { setDraftError(message); return }
    setDraft(null); setDraftError('')
    if (parsed !== value) flushSync(() => onChange(parsed))
    onBlur?.(parsed)
  }

  const count = dayMode ? new Date(year, month, 0).getDate() : 12
  const offset = dayMode ? (new Date(year, month - 1, 1).getDay() + 6) % 7 : 0
  const years = Array.from({ length: 201 }, (_, index) => 1900 + index)
  if (!years.includes(year)) years.push(year)

  return (
    <div className="date-picker" data-form-field={fieldKey}>
      <label htmlFor={id} className="sfield-label">
        {label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}
      </label>
      <div className={`date-picker__control${disabled ? ' date-picker__control--disabled' : ''}${error || draftError ? ' date-picker__control--invalid' : ''}`}>
        <input
          id={id} ref={trigger} className="date-picker__input" type="text" autoComplete="off"
          value={shown} placeholder={dayMode ? 'Select date' : 'Select month'}
          disabled={disabled}
          aria-invalid={error || draftError ? true : undefined}
          aria-haspopup="dialog" aria-expanded={open}
          aria-describedby={[hint ? `${id}-hint` : null, error || draftError ? `${id}-error` : null].filter(Boolean).join(' ') || undefined}
          onChange={(event) => { setDraft(event.target.value); setDraftError(''); event.target.setCustomValidity('') }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) { event.preventDefault(); toggle() }
            if (event.key === 'Enter' && draft != null) { event.preventDefault(); commitDraft() }
          }}
        />
        {value && !disabled && (
          <button type="button" className="date-picker__clear" aria-label={`Clear ${String(label).toLowerCase()}`}
            title="Clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select('')}>×</button>
        )}
        <button type="button" className="date-picker__icon" aria-label={`Choose ${String(label).toLowerCase()}`}
          aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={toggle}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v5m10-5v5M3 10h18" />
          </svg>
        </button>
      </div>
      {hint && <p className="sfield-hint" id={`${id}-hint`}>{hint}</p>}
      <InlineError id={`${id}-error`} message={draftError || error} />

      {open && createPortal(
        <div ref={popup} data-form-field={fieldKey} className="date-picker__popover" style={position}
          role="dialog" aria-label={`Choose ${String(label).toLowerCase()}`} onKeyDown={keyDown}>
          <div className="date-picker__navigation">
            <button type="button" aria-label={dayMode ? 'Previous month' : 'Previous year'}
              onClick={() => (dayMode ? moveMonth(-1) : setYear(year - 1))}>‹</button>
            {dayMode ? (
              <>
                <select aria-label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                  {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
                <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                  {years.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </>
            ) : <strong aria-live="polite">{year}</strong>}
            <button type="button" aria-label={dayMode ? 'Next month' : 'Next year'}
              disabled={!allowFuture && !dayMode && year >= now.getFullYear()}
              onClick={() => (dayMode ? moveMonth(1) : setYear(year + 1))}>›</button>
          </div>
          <div className={`date-picker__grid${dayMode ? ' date-picker__grid--days' : ''}`}>
            {dayMode && ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => <span key={day}>{day}</span>)}
            {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: count }, (_, index) => {
              const choice = dayMode ? isoDay(year, month, index + 1) : `${isoMonth(year, index + 1)}-01`
              const inactive = !inRange(choice)
              return (
                <button key={choice} type="button" className="date-picker__cell" aria-pressed={dayMode ? value === choice : String(value || '').slice(0, 7) === choice.slice(0, 7)}
                  aria-label={formatDate(choice, dayMode ? 'day' : 'month')} disabled={inactive}
                  onClick={() => select(choice)}>
                  {dayMode ? index + 1 : MONTHS[index]}
                </button>
              )
            })}
          </div>
          <footer className="date-picker__footer">
            {!dayMode && <button type="button" disabled={!inRange(`${isoMonth(now.getFullYear(), now.getMonth() + 1)}-01`)} onClick={() => select(`${isoMonth(now.getFullYear(), now.getMonth() + 1)}-01`)}>This month</button>}
            {dayMode && <button type="button" disabled={!inRange(today)} onClick={() => select(today)}>Today</button>}
            <button type="button" onClick={() => select('')}>Clear</button>
          </footer>
        </div>,
        document.body,
      )}
    </div>
  )
}
