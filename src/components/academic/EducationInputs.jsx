/** ============================================================================
 * EducationInputs — the two "typed" controls of the Education panel
 * ============================================================================
 * CountrySelect — a native <select> styled as an input with a small "▾".
 * MonthInput    — a text field showing "Sep 2023" that opens a month grid (or
 *                 accepts a typed "09/2023"). The parser itself lives in
 *                 utils/education.js and is unit-tested there.
 * Both are plain inputs underneath, so labels, keyboard and screen readers
 * behave exactly as they do everywhere else in the app.
 * ============================================================================ */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDate } from '../../utils/dates'
import { monthIso, parseMonthText } from '../../utils/education.js'

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

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

/** Month grid inside the popover; owns the visible year, not the value. */
function MonthGrid({ value, min, max, onChoose }) {
  const chosen = Number(String(value || '').slice(0, 4))
  const [year, setYear] = useState(() => chosen || new Date().getFullYear())
  const disabled = (choice) => Boolean((min && choice < min) || (max && choice > max))
  return (
    <>
      <div className="edu-month__nav">
        <button type="button" aria-label="Previous year" onClick={() => setYear((current) => current - 1)}>‹</button>
        <strong aria-live="polite">{year}</strong>
        <button type="button" aria-label="Next year" onClick={() => setYear((current) => current + 1)}>›</button>
      </div>
      <div className="edu-month__grid">
        {MONTHS.map((name, index) => {
          const choice = monthIso(year, index + 1)
          return (
            <button
              key={name} type="button" className="edu-month__cell"
              aria-pressed={value === choice}
              disabled={disabled(choice)}
              onClick={() => onChoose(choice)}
            >{name}</button>
          )
        })}
      </div>
      <div className="edu-month__foot">
        <button type="button" onClick={() => onChoose('')}>Clear</button>
        <button type="button" onClick={() => onChoose(monthIso(new Date().getFullYear(), new Date().getMonth() + 1))}>
          This month
        </button>
      </div>
    </>
  )
}

export function MonthInput({
  id, value, onChange, placeholder = 'Select month', invalid, min, max,
}) {
  const trigger = useRef(null)
  const popup = useRef(null)
  const [open, setOpen] = useState(null) // { top|bottom, left, width } while open
  const [text, setText] = useState(() => (value ? formatDate(value, 'month') : ''))

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (trigger.current?.contains(event.target) || popup.current?.contains(event.target)) return
      setOpen(null)
    }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(null)
      trigger.current?.focus()
    }
    const onResize = () => setOpen(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const show = () => {
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.max(rect.width, 264)
    const below = window.innerHeight - rect.bottom - 14
    const flip = below < 250 && rect.top > below
    setOpen({
      width,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    })
  }

  const choose = (next) => {
    setOpen(null)
    onChange(next)
    trigger.current?.focus({ preventScroll: true })
  }

  return (
    <div className="edu-month">
      <div className="edu-month__control">
        <input
          ref={trigger}
          id={id}
          className={`edu-input edu-input--date${value ? '' : ' edu-input--placeholder'}${invalid ? ' edu-input--invalid' : ''}`}
          value={text}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-haspopup="dialog"
          aria-expanded={Boolean(open)}
          autoComplete="off"
          onChange={(event) => {
            const raw = event.target.value
            setText(raw)
            const parsed = parseMonthText(raw)
            if (parsed && parsed !== value) onChange(parsed)
            else if (!raw.trim() && value) onChange('')
          }}
          onBlur={() => { if (!value) setText('') }}
          onFocus={() => { if (!open) show() }}
          onClick={() => { if (!open) show() }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) { event.preventDefault(); show() }
          }}
        />
        <button type="button" className="edu-month__icon" aria-label="Choose month"
          onClick={() => (open ? setOpen(null) : show())}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M7 3v5m10-5v5M3 10h18" />
          </svg>
        </button>
      </div>

      {open && createPortal(
        <div ref={popup} className="edu-month__popover" style={open} role="dialog" aria-label="Choose month">
          <MonthGrid value={value} min={min} max={max} onChoose={choose} />
        </div>,
        document.body,
      )}
    </div>
  )
}
