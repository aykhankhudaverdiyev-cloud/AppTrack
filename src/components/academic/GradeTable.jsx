/** ============================================================================
 * GradeTable — Subject × Grade 9 / 10 / 11 table of the Education panel
 * ============================================================================
 * One small centred input per cell. An empty Grade 11 cell shows a grey "—"
 * ("Add mid-year or predicted grades when available"), and emptying a cell
 * deletes its grade_rows row on save. "+ Add subject" appends a row; each row
 * has a quiet × that removes the subject only after a confirm.
 * ============================================================================ */

import { useCallback, useRef, useState } from 'react'
import { useAutosave } from '../../hooks/useAutosave'
import { ConfirmDialog } from '../forms'
import { GRADE_COLUMNS, cellGrade } from '../../utils/education.js'

const cellKey = (gradeLevel, semester = 1) => `${gradeLevel}:${semester}`

export default function GradeTable({ subjects = [], gradingScale, onChange, onSave, enabled = true }) {
  const [removeIndex, setRemoveIndex] = useState(null)
  const dirty = useRef(false)

  const persist = useCallback(async (value) => {
    if (!dirty.current || !enabled) return
    await onSave?.(value)
    dirty.current = false
  }, [onSave, enabled])

  const save = useAutosave(subjects, persist, { delay: 800, enabled })
  const touch = () => { dirty.current = true; save.markDirty() }

  const write = (next) => { touch(); onChange?.(next) }
  const setCell = (index, gradeLevel, raw) => {
    const clean = raw.slice(0, 6)
    write(subjects.map((subject, position) => {
      if (position !== index) return subject
      const cells = { ...subject.cells }
      const key = cellKey(gradeLevel)
      cells[key] = { ...(cells[key] || {}), grade: clean }
      return { ...subject, cells }
    }))
  }
  const addSubject = () => {
    if (subjects.some((subject) => !String(subject.name || '').trim())) {
      // Focus the empty row instead of stacking another one.
      document.querySelector('.edu-grades__name--empty')?.focus()
      return
    }
    // The row is keyed by its index until it has a name (see the <tr> key).
    write([...subjects, { key: '', name: '', cells: {} }])
  }
  const rename = (index, name) => write(subjects.map((subject, position) => (
    position === index ? { ...subject, name } : subject
  )))
  const removeSubject = (index) => {
    write(subjects.filter((_, position) => position !== index))
    setRemoveIndex(null)
  }

  return (
    <div className="edu-grades">
      <div className="edu-grades__box">
        <table className="edu-grades__table">
          <thead>
            <tr>
              <th scope="col" className="edu-grades__subject">Subject</th>
              {GRADE_COLUMNS.map((grade) => (
                <th key={grade} scope="col">Grade {grade}</th>
              ))}
              <th scope="col" className="edu-grades__action"><span className="sr-only">Remove subject</span></th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr>
                <td colSpan={GRADE_COLUMNS.length + 2} className="edu-grades__empty">
                  No subjects yet. Add the subjects you took this year.
                </td>
              </tr>
            )}
            {subjects.map((subject, index) => (
              <tr key={subject.key || subject.name || index}>
                <th scope="row" className="edu-grades__subject">
                  <input
                    className={`edu-grades__name${subject.name ? '' : ' edu-grades__name--empty'}`}
                    value={subject.name || ''}
                    placeholder="Subject"
                    aria-label={`Subject ${index + 1}`}
                    onChange={(event) => rename(index, event.target.value.slice(0, 40))}
                    onBlur={() => save.flush()}
                  />
                </th>
                {GRADE_COLUMNS.map((grade) => {
                  const value = cellGrade(subject, grade)
                  const showDash = !value && grade === GRADE_COLUMNS[GRADE_COLUMNS.length - 1]
                  return (
                    <td key={grade}>
                      <input
                        className={`edu-grades__cell${showDash ? ' edu-grades__cell--dash' : ''}`}
                        value={value}
                        placeholder="—"
                        inputMode={gradingScale === '0–100' || gradingScale === '1–5' ? 'numeric' : 'text'}
                        aria-label={`${subject.name || `Subject ${index + 1}`}, grade ${grade}`}
                        title={gradingScale ? `Grade on the ${gradingScale} scale` : undefined}
                        onChange={(event) => setCell(index, grade, event.target.value)}
                        onBlur={() => save.flush()}
                      />
                    </td>
                  )
                })}
                <td className="edu-grades__action">
                  <button type="button" className="edu-grades__remove" aria-label={`Remove ${subject.name || `subject ${index + 1}`}`}
                    onClick={() => setRemoveIndex(index)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="edu-grades__helper">Add mid-year or predicted grades when available</p>

      <div className="edu-grades__foot">
        <button type="button" className="edu-link" onClick={addSubject}>
          <span aria-hidden="true">＋</span> Add subject
        </button>
        <span className="edu-helper" role="status" aria-live="polite">
          {save.error ? 'Grades not saved · ' : ''}
          {save.error && <button type="button" className="edu-link" onClick={save.flush}>Retry</button>}
          {!save.error && save.isDirty ? 'Saving grades…' : ''}
        </span>
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
