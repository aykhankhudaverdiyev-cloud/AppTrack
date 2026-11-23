/** ============================================================================
 * educationMockApi — offline stand-in for src/Services/educationApi.js
 * ============================================================================
 * Used ONLY by the design-review page (index.education-preview.html via
 * vite.preview.config.js, which aliases the real API to this file). It is not
 * imported by the app, so it never reaches the production bundle.
 * Reads resolve from fixtures; writes mutate the fixture list in memory.
 * ============================================================================ */

const USER_ID = '00000000-0000-4000-8000-000000000001'
const delay = () => new Promise((resolve) => { setTimeout(resolve, 80) })
const clone = (value) => JSON.parse(JSON.stringify(value))
let sequence = 100

const grade = (entryId, name, level, value, order, index) => ({
  id: `grade-${index}`,
  entry_id: entryId,
  user_id: USER_ID,
  subject: name,
  grade_level: level,
  semester: 1,
  grade: value,
  is_predicted: false,
  sort_order: order,
})

const entryId = 'edu-preview-1'
const FIRST = {
  id: entryId,
  user_id: USER_ID,
  entry_type: 'secondary_school',
  institution_name: 'Republican Physics, Mathematics and Informatics Lyceum',
  country: 'Azerbaijan',
  city: 'Baku',
  ceeb_code: null,
  language_of_instruction: 'Azerbaijani',
  start_date: '2023-09-01',
  end_date: '2027-06-01',
  is_current: true,
  qualification: 'National diploma (Attestat)',
  grading_scale: '1–5',
  overall_average: 5,
  scale_maximum: 5,
  class_rank: null,
  class_size: 33,
  school_does_not_rank: true,
  school_counselor_name: 'Elchin Mammadov',
  school_counselor_email: null,
  school_counselor_phone: null,
  transcript_document_id: null,
  sort_order: 0,
  created_at: '2026-11-20T09:00:00.000Z',
  grades: [
    grade(entryId, 'Mathematics', 9, '5', 0, 0),
    grade(entryId, 'Mathematics', 10, '5', 1, 1),
    grade(entryId, 'Informatics', 9, '5', 10, 2),
    grade(entryId, 'Informatics', 10, '5', 11, 3),
    grade(entryId, 'Physics', 9, '5', 20, 4),
    grade(entryId, 'Physics', 10, '5', 21, 5),
    grade(entryId, 'English', 9, '5', 30, 6),
    grade(entryId, 'English', 10, '5', 31, 7),
  ],
}

let entries = [FIRST]

export const previewUserId = USER_ID

export async function listEducation() {
  await delay()
  return clone(entries).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

export async function createEntry(userId, fields) {
  await delay()
  sequence += 1
  const row = { id: `edu-preview-${sequence}`, user_id: USER_ID, created_at: new Date().toISOString(), grades: [], ...clone(fields) }
  entries = [...entries, row]
  return clone(row)
}

export async function updateEntry(userId, id, fields) {
  await delay()
  entries = entries.map((entry) => (entry.id === id ? { ...entry, ...clone(fields) } : entry))
  return clone(entries.find((entry) => entry.id === id))
}

export async function deleteEntry(userId, id) {
  await delay()
  entries = entries.filter((entry) => entry.id !== id)
}

export async function duplicateEntry(userId, entry, sortOrder = 0) {
  await delay()
  sequence += 1
  const copy = { ...clone(entry), id: `edu-preview-${sequence}`, institution_name: `${entry.institution_name} (copy)`, sort_order: sortOrder, grades: [] }
  entries = [...entries, copy]
  return clone(copy)
}

export async function saveGrades(userId, id, subjects) {
  await delay()
  const rows = subjects.flatMap((item, subjectIndex) => Object.entries(item.cells || {})
    .filter(([, cell]) => String(cell?.grade || '').trim())
    .map(([key, cell], cellIndex) => {
      const [gradeLevel, semester] = key.split(':').map(Number)
      sequence += 1
      return {
        id: cell.id || `grade-saved-${sequence}`,
        entry_id: id,
        user_id: USER_ID,
        subject: item.name,
        grade_level: gradeLevel,
        semester,
        grade: String(cell.grade),
        is_predicted: Boolean(cell.is_predicted),
        sort_order: subjectIndex * 10 + cellIndex,
      }
    }))
  entries = entries.map((entry) => (entry.id === id ? { ...entry, grades: rows } : entry))
  return clone(rows)
}
