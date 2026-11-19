import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDate } from '../../utils/dates'
import { InlineError } from '../forms/PanelValidation'
import './section.css'

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const pad = (n) => String(n).padStart(2, '0')
const iso = (year, month, day) => `${year}-${pad(month)}${day === undefined ? '' : `-${pad(day)}`}`

export default function DatePicker({ label, mode = 'month', value = '', onChange, required, error, fieldKey, allowFuture = true }) {
  const id = useId()
  const trigger = useRef(null)
  const popup = useRef(null)
  const [position, setPosition] = useState(null)
  const [year, setYear] = useState(0)
  const [month, setMonth] = useState(1)
  const now = new Date()
  const today = iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const dayMode = mode === 'day'
  const open = Boolean(position)

  useEffect(() => {
    if (!open) return
    const close = () => setPosition(null)
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    const element = popup.current
    ;(element.querySelector('[aria-pressed="true"]:not(:disabled)') ?? element.querySelector('.date-picker__cell:not(:disabled)'))?.focus({ preventScroll: true })
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close) }
  }, [open])

  const toggle = () => {
    if (open) { setPosition(null); return }
    const [y, m] = (value || today).split('-').map(Number)
    setYear(y); setMonth(m)
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.min(324, window.innerWidth - 16)
    const below = window.innerHeight - rect.bottom - 14
    const above = rect.top - 14
    const flip = below < (dayMode ? 365 : 255) && above > below
    setPosition({ width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), maxHeight: Math.max(64, flip ? above : below),
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) })
  }
  const close = () => { setPosition(null); trigger.current.focus({ preventScroll: true }) }
  const select = (next) => { onChange(next); close() }
  const moveMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1)
    setYear(next.getFullYear()); setMonth(next.getMonth() + 1)
  }
  const keyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (!event.target.matches('.date-picker__cell')) return
    const columns = dayMode ? 7 : 3
    const distance = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key]
    if (!distance) return
    event.preventDefault()
    const cells = [...popup.current.querySelectorAll('.date-picker__cell:not(:disabled)')]
    cells[cells.indexOf(event.target) + distance]?.focus()
  }
  const count = dayMode ? new Date(year, month, 0).getDate() : 12
  const offset = dayMode ? (new Date(year, month - 1, 1).getDay() + 6) % 7 : 0
  const years = Array.from({ length: 201 }, (_, i) => 1900 + i)
  if (year && !years.includes(year)) years.push(year)

  return <div className="date-picker" data-form-field={fieldKey}>
    <label htmlFor={id} className="sfield-label">{label}{required && <span className="sfield-req" aria-hidden="true"> *</span>}</label>
    <button ref={trigger} id={id} type="button" className={`date-picker__trigger${value ? '' : ' date-picker__trigger--empty'}`} onClick={toggle}
      aria-haspopup="dialog" aria-expanded={open} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
      {value ? formatDate(value, dayMode ? 'day' : 'month') : dayMode ? 'Select date' : 'Select month'}
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 10h18"/></svg>
    </button>
    <InlineError id={`${id}-error`} message={error} />
    {open && createPortal(<div ref={popup} data-form-field={fieldKey} className="date-picker__popover" style={position} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} onKeyDown={keyDown}>
      <div className="date-picker__navigation">
        <button type="button" aria-label={dayMode ? 'Previous month' : 'Previous year'} onClick={() => dayMode ? moveMonth(-1) : setYear(year - 1)}>‹</button>
        {dayMode ? <>
          <select aria-label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
          <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        </> : <strong aria-live="polite">{year}</strong>}
        <button type="button" aria-label={dayMode ? 'Next month' : 'Next year'} disabled={!allowFuture && !dayMode && year >= now.getFullYear()} onClick={() => dayMode ? moveMonth(1) : setYear(year + 1)}>›</button>
      </div>
      <div className={`date-picker__grid${dayMode ? ' date-picker__grid--days' : ''}`}>
        {dayMode && ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => <span key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}
        {Array.from({ length: count }, (_, i) => {
          const choice = dayMode ? iso(year, month, i + 1) : iso(year, i + 1)
          return <button key={choice} className="date-picker__cell" type="button" aria-pressed={value === choice}
            aria-label={formatDate(choice, dayMode ? 'day' : 'month')} disabled={!allowFuture && choice > today.slice(0, choice.length)} onClick={() => select(choice)}>
            {dayMode ? i + 1 : MONTHS[i]}
          </button>
        })}
      </div>
      <footer className="date-picker__footer"><button type="button" onClick={() => select('')}>Clear</button>
        {dayMode && <button type="button" onClick={() => select(today)}>Today</button>}</footer>
    </div>, document.body)}
  </div>
}
