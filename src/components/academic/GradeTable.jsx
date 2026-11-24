/** ============================================================================
 * GradeTable — the GRADES section of the Education panel
 * ============================================================================
 * Columns come from the entry's `final_grade_level` ("Grade 9 / 10 / 11" for a
 * school ending at grade 11, "Grade 10 / 11 / 12" for 12 …). Each grade level
 * shows one column; "Show semesters" splits it into "S1 · S2 · Final".
 *
 * Sticky Subject column, 32 px icon-only remove column, 40 px subject input
 * with suggestions, inline duplicate error, Excel block paste, scale-validated
 * cells (red border + tooltip, never saved), per-cell "Mark as predicted".
 * Saving replaces the whole table through save_grade_rows in one transaction.
 * ============================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../forms'
import {
  cellAt, cellGrade, duplicateSubjectIndex, finalGradeAverage, gradeError,
  gradeLevels, semesterLabel, subjectSuggestions,
} from '../../utils/education.js'

const numericScale = (scale) => scale === '0–100' || scale === '1–5' || scale === '1–7'
  || scale === '0–20' || scale === '4.0 GPA'

const cellKey = (level, semester) => `${level}:${semester ?? 'final'}`

let rowSequence = 0
const nextRowKey = () => { rowSequence += 1; return `row-${rowSequence}` }

/** Columns for one grade level: the level itself, or its semesters. */
function columnsFor(level, showSemesters) {
  return showSemesters ? [1, 2, null] : [null]
}

export default function GradeTable({
  subjects = [], gradingScale, finalGradeLevel, showSemesters = false,
  onChange, onSave, onUseAverage, enabled = true,
}) {
  const [removeIndex, setRemoveIndex] = useState(null)
  const [suggestFor, setSuggestFor] = useState(null)
  const [menuFor, setMenuFor] = useState(null)
  const focusCell = useRef(null)
  const dirty = useRef(false)
  const saving = useRef(false)
  const timer = useRef(null)
  const latest = useRef(subjects)
  const table = useRef(null)

  const levels = useMemo(() => gradeLevels(finalGradeLevel), [finalGradeLevel])
  const columns = useMemo(
    () => levels.flatMap((level) => columnsFor(level, showSemesters).map((semester) => ({ level, semester }))),
    [levels, showSemesters],
  )
  const numeric = numericScale(gradingScale)
  const duplicateAt = duplicateSubjectIndex(subjects)
  const average = finalGradeAverage(subjects)

  useEffect(() => { latest.current = subjects }, [subjects])

  const persist = useCallback(async () => {
    if (!enabled || saving.current) return
    saving.current = true
    try {
      await onSave?.(latest.current)
      dirty.current = false
    } catch {
      // The caller surfaces the error; keep the draft dirty so Retry works.
    } finally {
      saving.current = false
    }
  }, [enabled, onSave])

  // 800 ms debounce: the table is one payload, so a fast typist saves once.
  const touch = useCallback(() => {
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { if (dirty.current) persist() }, 800)
  }, [persist])

  useEffect(() => () => clearTimeout(timer.current), [])

  // Flush on unmount (closing the panel must not lose the last keystroke).
  useEffect(() => () => { if (dirty.current) persist() }, [persist])

  // Keep focus after a structural change (Enter adds a row, paste adds rows).
  // A ref, not state: focusing is a DOM side effect, not a render input.
  useEffect(() => {
    const target = focusCell.current
    if (!target) return
    focusCell.current = null
    table.current?.querySelector(`[data-cell="${target}"]`)?.focus()
  }, [subjects])

  const write = (next) => { touch(); onChange?.(next) }
  const setCell = (index, level, semester, raw) => {
    const clean = raw.slice(0, 10)
    write(subjects.map((subject, position) => {
      if (position !== index) return subject
      const cells = { ...subject.cells }
      const key = cellKey(level, semester)
      const previous = cells[key] || {}
      if (!clean) delete cells[key]
      else cells[key] = { ...previous, grade: clean }
      return { ...subject, cells }
    }))
  }
  const togglePredicted = (index, level, semester) => {
    write(subjects.map((subject, position) => {
      if (position !== index) return subject
      const cells = { ...subject.cells }
      const key = cellKey(level, semester)
      const cell = cells[key] || { grade: '' }
      cells[key] = { ...cell, is_predicted: !cell.is_predicted }
      return { ...subject, cells }
    }))
  }
  const rename = (index, name) => write(subjects.map((subject, position) => (
    position === index ? { ...subject, name } : subject
  )))
  const addRow = () => {
    write([...subjects, { key: nextRowKey(), name: '', cells: {} }])
    focusCell.current = `name:${subjects.length}`
  }
  const removeSubject = (index) => {
    write(subjects.filter((_, position) => position !== index))
    setRemoveIndex(null)
  }

  /* --- keyboard: Tab / arrows / Enter ------------------------------------- */

  const move = (row, column) => {
    const target = table.current?.querySelector(`[data-cell="${row}:${column}"]`)
    target?.focus()
    target?.select?.()
  }
  const onCellKeyDown = (event, rowIndex, columnIndex) => {
    const { key, shiftKey } = event
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      event.preventDefault()
      move(rowIndex, columnIndex + (key === 'ArrowRight' ? 1 : -1))
      return
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      move(rowIndex + (key === 'ArrowDown' ? 1 : -1), columnIndex)
      return
    }
    if (key === 'Enter' && !shiftKey) {
      event.preventDefault()
      const isLastRow = rowIndex === subjects.length - 1
      const isLastColumn = columnIndex === columns.length - 1
      if (isLastRow && isLastColumn) { addRow(); return }
      move(rowIndex + 1, columnIndex)
    }
  }

  /* --- Excel block paste --------------------------------------------------- */

  const onPaste = (event, rowIndex, columnIndex) => {
    const raw = event.clipboardData?.getData('text/plain') || ''
    if (!raw.includes('\t') && !raw.includes('\n')) return
    event.preventDefault()
    const grid = raw.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((line) => line.split('\t'))
    const next = subjects.map((subject) => ({ ...subject, cells: { ...subject.cells } }))
    grid.forEach((line, rowOffset) => {
      const target = rowIndex + rowOffset
      if (target >= next.length) next.push({ key: nextRowKey(), name: '', cells: {} })
      line.forEach((value, columnOffset) => {
        const column = columns[columnIndex + columnOffset]
        if (!column) return
        const clean = String(value).trim().slice(0, 10)
        const key = cellKey(column.level, column.semester)
        if (!clean) delete next[target].cells[key]
        else next[target].cells[key] = { ...(next[target].cells[key] || {}), grade: clean }
      })
    })
    write(next)
  }

  const headerLabel = (level) => `Grade ${level}`

  return (
    <div className="edu-grades">
      <div className="edu-grades__box">
        <table className="edu-grades__table" ref={table}>
          <thead>
            <tr>
              <th scope="col" className="edu-grades__subject">Subject</th>
              {levels.map((level) => {
                const span = columnsFor(level, showSemesters).length
                return showSemesters
                  ? <th key={level} scope="colgroup" colSpan={span} className="edu-grades__group">{headerLabel(level)}</th>
                  : <th key={level} scope="col">{headerLabel(level)}</th>
              })}
              <th scope="col" className="edu-grades__action"><span className="sr-only">Remove subject</span></th>
            </tr>
            {showSemesters && (
              <tr className="edu-grades__subhead">
                <th scope="col" className="edu-grades__subject" aria-hidden="true" />
                {columns.map(({ level, semester }) => (
                  <th key={`${level}:${semester}`} scope="col" className="edu-grades__sub">
                    {semesterLabel(semester)}
                  </th>
                ))}
                <th scope="col" className="edu-grades__action" aria-hidden="true" />
              </tr>
            )}
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="edu-grades__empty">
                  No subjects yet. Add the subjects you took, or paste your table from Excel.
                </td>
              </tr>
            )}
            {subjects.map((subject, rowIndex) => (
              <tr key={subject.key || subject.name || rowIndex}>
                <th scope="row" className="edu-grades__subject">
                  <div className="edu-grades__namewrap">
                    <input
                      className={`edu-grades__name${subject.name ? '' : ' edu-grades__name--empty'}`}
                      data-cell={`${rowIndex}:name`}
                      value={subject.name || ''}
                      placeholder="Subject"
                      maxLength={80}
                      aria-label={`Subject ${rowIndex + 1}`}
                      aria-invalid={duplicateAt === rowIndex || undefined}
                      onChange={(event) => { rename(rowIndex, event.target.value); setSuggestFor(rowIndex) }}
                      onFocus={() => setSuggestFor(rowIndex)}
                      onBlur={() => { setSuggestFor(null); persist() }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); addRow() }
                        if (event.key === 'Escape') setSuggestFor(null)
                      }}
                    />
                    {suggestFor === rowIndex && subjectSuggestions(subject.name, subjects.map((item) => item.name)).length > 0 && (
                      <ul className="edu-grades__suggest" role="listbox" aria-label="Subject suggestions">
                        {subjectSuggestions(subject.name, subjects.map((item) => item.name)).map((name) => (
                          <li key={name}>
                            <button type="button" role="option" aria-selected={false}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => { rename(rowIndex, name); setSuggestFor(null) }}>{name}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {duplicateAt === rowIndex && (
                    <p className="edu-grades__error" role="alert">This subject is already in the table.</p>
                  )}
                </th>
                {columns.map(({ level, semester }, columnIndex) => {
                  const key = cellKey(level, semester)
                  const cell = cellAt(subject, level, semester)
                  const value = cellGrade(subject, level, semester)
                  const error = gradeError(value, gradingScale)
                  return (
                    <td key={key}>
                      <div className="edu-grades__cellwrap">
                        <input
                          className={`edu-grades__cell${error ? ' edu-grades__cell--invalid' : ''}${cell?.is_predicted ? ' edu-grades__cell--predicted' : ''}`}
                          data-cell={`${rowIndex}:${columnIndex}`}
                          value={value}
                          placeholder="—"
                          inputMode={numeric ? 'decimal' : 'text'}
                          aria-label={`${subject.name || `Subject ${rowIndex + 1}`}, ${headerLabel(level)} ${semesterLabel(semester)}`}
                          aria-invalid={error ? true : undefined}
                          title={error || (cell?.is_predicted ? 'Predicted grade' : undefined)}
                          onChange={(event) => setCell(rowIndex, level, semester, event.target.value)}
                          onBlur={persist}
                          onKeyDown={(event) => onCellKeyDown(event, rowIndex, columnIndex)}
                          onPaste={(event) => onPaste(event, rowIndex, columnIndex)}
                        />
                        {cell?.is_predicted && <span className="edu-grades__badge" aria-hidden="true">P</span>}
                        {value && !error && (
                          <>
                            <button
                              type="button" className="edu-grades__more"
                              aria-haspopup="menu"
                              aria-expanded={menuFor === key}
                              aria-label={`${subject.name || `Subject ${rowIndex + 1}`} ${headerLabel(level)} ${semesterLabel(semester)}: grade options`}
                              title={cell?.is_predicted ? 'Predicted grade' : 'Grade options'}
                              onClick={() => setMenuFor(menuFor === key ? null : key)}
                            >⋯</button>
                            {menuFor === key && (
                              <div className="edu-grades__menu" role="menu">
                                <button type="button" role="menuitem"
                                  onClick={() => { togglePredicted(rowIndex, level, semester); setMenuFor(null) }}>
                                  {cell?.is_predicted ? 'Remove predicted mark' : 'Mark as predicted'}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="edu-grades__action">
                  <button type="button" className="edu-grades__remove"
                    aria-label={`Remove ${subject.name || `subject ${rowIndex + 1}`}`}
                    title="Remove subject"
                    onClick={() => setRemoveIndex(rowIndex)}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="edu-grades__foot">
        <button type="button" className="edu-link" onClick={addRow}>
          <span aria-hidden="true">＋</span> Add subject
        </button>
        {average && (
          <p className="edu-helper edu-grades__average">
            Average of entered final grades: {average}
            <button type="button" className="edu-link edu-link--inline"
              onClick={() => onUseAverage?.(average)}>Use this</button>
          </p>
        )}
      </div>

      <ConfirmDialog
        open={removeIndex != null}
        title={`Remove ${subjects[removeIndex]?.name || 'this subject'}?`}
        message="Its grades are removed from this entry."
        confirmLabel="Remove"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={() => removeSubject(removeIndex)}
      />
    </div>
  )
}
