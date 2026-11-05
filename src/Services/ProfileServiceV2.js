/**
 * ============================================================================
 * ProfileServiceV2 — structured profile (spec §3)
 * ----------------------------------------------------------------------------
 * Owns the Phase-0 columns/tables:
 *   profiles (new structured columns) · profile_private (1:1 sensitive) ·
 *   parents (up to 2 parents + 1 guardian)
 * Legacy columns (full_name, phone, gender...) keep being handled by the
 * existing services/dashboard — this module only manages the NEW fields.
 * ============================================================================
 */
import { supabase } from "../lib/supabase"
import { zonedInputToUtcIso, utcToZonedInput } from "../utils/timezone"
import { computeRequirementProgress } from "../utils/applicationRequirements"
import { notifyDataChanged } from "../store/studentsStore"
import { mapLegacyAcademicItem, isValidSatSectionScore, scoreExpiryDate } from "../utils/academicRules"

/** camelCase → snake_case whitelist for the new profiles columns. */
const PROFILE_FIELD_MAP = {
  givenName: "given_name",
  middleName: "middle_name",
  familyName: "family_name",
  preferredName: "preferred_name",
  passportName: "passport_name",
  nativeScriptName: "native_script_name",
  pronouns: "pronouns",
  languages: "languages",
  firstGeneration: "first_generation",
  applyingLevel: "applying_level",
  startTerm: "start_term",
  intendedMajor1: "intended_major_1",
  intendedMajor2: "intended_major_2",
  willApplyFinancialAid: "will_apply_financial_aid",
  gapYearPlanned: "gap_year_planned",
  gradCurrentDegree: "grad_current_degree",
  gradDegreeStatus: "grad_degree_status",
  workExperienceYears: "work_experience_years",
  researchInterests: "research_interests",
  orcid: "orcid",
  googleScholar: "google_scholar",
  linkedin: "linkedin",
}

/** Whitelist for profile_private (the ONLY writer path; RLS enforces owner). */
const PRIVATE_FIELD_MAP = {
  dateOfBirth: "date_of_birth",
  countryOfBirth: "country_of_birth",
  citizenships: "citizenships",
  dualCitizenship: "dual_citizenship",
  passportNumber: "passport_number",
  passportExpiry: "passport_expiry",
  permanentAddress: "permanent_address",
  currentAddress: "current_address",
  householdSize: "household_size",
  siblings: "siblings",
}

function pick(map, fields) {
  const out = {}
  for (const [camel, snake] of Object.entries(map)) {
    if (camel in fields) out[snake] = fields[camel]
  }
  return out
}

/**
 * Load everything the My Profile page needs in parallel.
 * @returns {{profile: object, private: object|null, parents: Array}}
 */
export async function fetchProfileV2(userId) {
  const [profileRes, privateRes, parentsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("profile_private").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("parents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ])

  if (profileRes.error) throw profileRes.error
  if (privateRes.error) throw privateRes.error
  if (parentsRes.error) throw parentsRes.error

  return {
    profile: profileRes.data,
    private: privateRes.data,
    parents: parentsRes.data || [],
  }
}

/** Update whitelisted new-column profile fields. Returns the updated row. */
export async function updateProfileFields(userId, fields) {
  const payload = pick(PROFILE_FIELD_MAP, fields)
  if (Object.keys(payload).length === 0) throw new Error("No updatable fields provided")

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Insert-or-update the 1:1 sensitive profile row. */
export async function upsertProfilePrivate(userId, fields) {
  const payload = pick(PRIVATE_FIELD_MAP, fields)
  const { data, error } = await supabase
    .from("profile_private")
    .upsert({ user_id: userId, ...payload })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Add or update a parent/guardian (max 2 parents + 1 guardian, app-enforced). */
export async function saveParent(userId, parent) {
  const row = {
    kind: parent.kind,
    full_name: parent.fullName,
    is_living: parent.isLiving !== false,
    education_level: parent.educationLevel || null,
    occupation: parent.occupation || null,
    employer: parent.employer || null,
    email: parent.email || null,
  }

  if (parent.id) {
    const { data, error } = await supabase
      .from("parents")
      .update(row)
      .eq("id", parent.id)
      .eq("user_id", userId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from("parents")
    .insert({ user_id: userId, ...row })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteParent(userId, parentId) {
  const { error } = await supabase
    .from("parents")
    .delete()
    .eq("id", parentId)
    .eq("user_id", userId)
  if (error) throw error
  return true
}

/* ============================================================================
   Applications (spec §11) — Phase 3
   ----------------------------------------------------------------------------
   universitIES = public reference data (autocomplete).
   The 5 child tables are owner/counselor/admin RLS-protected; EVERY row needs
   user_id. Rows are synced as a whole list via upsert on a client-generated
   UUID, so a student can add/reorder/edit rows without a reload after each
   keystroke. Legacy `applications` columns are still written by the store —
   this module only maintains the two caches that old views read:
     • applications.deadline       ← main "application" deadline, ORIGINAL date
     • applications.progress_percent ← checklist completion (0–100)
   ========================================================================== */
/** Valid RFC 4122-shaped UUID even when crypto.randomUUID is unavailable. */
export function newApplicationRowId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export async function searchUniversities(query = "", limit = 25) {
  const q = String(query || "").trim().replace(/[%_]/g, " ").slice(0, 80)
  let builder = supabase
    .from("universities")
    .select("id,name,country,city")
    .order("name", { ascending: true })
    .limit(limit)
  if (q) builder = builder.ilike("name", `%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return data || []
}

export async function fetchUniversityById(universityId) {
  if (!universityId) return null
  const { data, error } = await supabase
    .from("universities")
    .select("id,name,country,city")
    .eq("id", universityId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Owner's essays available for linking (Phase 2 essay table). */
export async function fetchApplicationEssayOptions(userId) {
  try {
    const { data, error } = await supabase
      .from("essays")
      .select("id,title,essay_type,status")
      .eq("user_id", userId)
      .order("title", { ascending: true })
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn("Essays not available yet:", err)
    return []
  }
}

/** All Phase 3 data for one application, loaded in parallel. */
export async function fetchApplicationWorkspace(userId, applicationId) {
  const [
    { data: choices, error: choicesError },
    { data: deadlines, error: deadlinesError },
    { data: requirements, error: requirementsError },
    { data: interviews, error: interviewsError },
  ] = await Promise.all([
    supabase.from("application_choices").select("*")
      .eq("user_id", userId).eq("application_id", applicationId)
      .order("rank_order", { ascending: true }),
    supabase.from("application_deadlines").select("*")
      .eq("user_id", userId).eq("application_id", applicationId)
      .order("due_at", { ascending: true }),
    supabase.from("application_requirements").select("*")
      .eq("user_id", userId).eq("application_id", applicationId)
      .order("sort_order", { ascending: true }),
    supabase.from("interviews").select("*")
      .eq("user_id", userId).eq("application_id", applicationId)
      .order("scheduled_at", { ascending: true }),
  ])

  for (const err of [choicesError, deadlinesError, requirementsError, interviewsError]) {
    if (err) throw err
  }

  // Essay links are Phase 2 territory; degrade gracefully if that table (or
  // the Essays tab) has not landed in this environment yet.
  let essayLinks = []
  try {
    const { data, error } = await supabase
      .from("application_essays")
      .select("id,essay_id,ai_rules_note")
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true })
    if (error) throw error
    essayLinks = data || []
  } catch (err) {
    console.warn("Application essay links not available yet:", err)
  }

  return {
    choices: choices || [],
    deadlines: deadlines || [],
    requirements: requirements || [],
    interviews: interviews || [],
    essayLinks,
    essayOptions: await fetchApplicationEssayOptions(userId),
  }
}

/** Deadlines for the Overview widgets (all applications of one student). */
export async function fetchStudentDeadlines(userId) {
  const { data, error } = await supabase
    .from("application_deadlines")
    .select("id,application_id,kind,label,due_at,original_timezone")
    .eq("user_id", userId)
    .order("due_at", { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Replace a whole child list. Client-generated UUIDs make this a single
 * upsert + one delete, with no server round trip needed to learn new IDs.
 */
async function syncRows(table, userId, applicationId, rows, toRow, parentKey = "application_id") {
  const payload = rows.map((row, index) => ({
    id: row.id || newApplicationRowId(),
    user_id: userId,
    [parentKey]: applicationId,
    ...toRow(row, index),
  }))

  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq(parentKey, applicationId)
  if (fetchError) throw fetchError

  const keep = new Set(payload.map((p) => p.id))
  const stale = (existing || []).map((r) => r.id).filter((id) => !keep.has(id))
  const removeStale = async () => {
    if (!stale.length) return
    const { error } = await supabase.from(table).delete().in("id", stale).eq("user_id", userId).eq(parentKey, applicationId)
    if (error) throw error
  }
  // Application child tables have additional unique keys; preserve their Phase 3
  // deletion order. Academic child tables can safely upsert before deleting.
  if (parentKey === "application_id") await removeStale()
  if (payload.length) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" })
    if (error) throw error
  }
  if (parentKey !== "application_id") await removeStale()
  return payload.map((p) => p.id)
}

async function patchLegacyApplication(userId, applicationId, patch) {
  const { error } = await supabase
    .from("applications")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("student_id", userId)
  if (error) throw error
}

export async function saveApplicationChoices(userId, applicationId, choices = [], max = 10) {
  const clean = choices
    .filter((c) => String(c.programName || "").trim())
    .slice(0, max)
  if (choices.length > max) throw new Error(`This university allows at most ${max} programme choices.`)
  await syncRows("application_choices", userId, applicationId, clean, (row, index) => ({
    rank_order: index + 1,
    program_name: String(row.programName).trim(),
    program_code: row.programCode || null,
    major: row.major || null,
    minor: row.minor || null,
  }))
  return clean
}

export async function saveApplicationDeadlines(userId, applicationId, deadlines = []) {
  // New rows that are still being typed are simply not persisted yet; existing
  // rows keep their last stored instant if the user temporarily clears a field.
  const clean = deadlines
    .map((d) => ({
      ...d,
      due_at: zonedInputToUtcIso(d.date, d.time, d.originalTimezone || "UTC") || d.dueAtIso || null,
    }))
    .filter((d) => d.due_at)
  await syncRows("application_deadlines", userId, applicationId, clean, (row) => ({
    kind: row.kind || "application",
    label: row.label || null,
    due_at: row.due_at,
    original_timezone: row.originalTimezone || "UTC",
  }))

  // Keep the legacy DATE column in sync for admin / public / old views.
  // It must be the ORIGINAL university date, not the student's local date.
  const main = [...clean]
    .filter((d) => d.kind === "application")
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0]
  const legacyDeadline = main
    ? utcToZonedInput(main.due_at, main.originalTimezone || "UTC").date
    : null
  await patchLegacyApplication(userId, applicationId, { deadline: legacyDeadline })
  return { legacyDeadline }
}

export async function saveApplicationRequirements(userId, applicationId, requirements = []) {
  const seen = new Set()
  const clean = requirements.map((r, index) => {
    let key = String(r.reqKey || "").trim()
    if (!key) key = `custom_${newApplicationRowId().slice(0, 8)}`
    if (seen.has(key)) throw new Error(`Duplicate checklist key: ${key}`)
    seen.add(key)
    return { ...r, reqKey: key, sortOrder: index, label: String(r.label || "Requirement").trim() }
  })
  await syncRows("application_requirements", userId, applicationId, clean, (row, index) => ({
    req_key: row.reqKey,
    label: row.label,
    status: row.status || "not_started",
    meta: row.meta || {},
    sort_order: index,
  }))

  // Cache the checklist result on the application — feeds the Overview card.
  const progress = computeRequirementProgress(clean)
  await patchLegacyApplication(userId, applicationId, { progress_percent: progress })
  return { progress }
}

export async function saveApplicationInterviews(userId, applicationId, interviews = []) {
  await syncRows("interviews", userId, applicationId, interviews, (row) => ({
    scheduled_at: row.date && row.time
      ? zonedInputToUtcIso(row.date, row.time, row.originalTimezone || "UTC")
      : null,
    original_timezone: row.originalTimezone || "UTC",
    interview_type: row.interviewType || null,
    interviewer: row.interviewer || null,
    prep_notes: row.prepNotes || null,
    thank_you_sent_on: row.thankYouSentOn || null,
  }))
  return interviews
}

export async function saveApplicationEssayLinks(userId, applicationId, links = []) {
  const seen = new Set()
  const clean = links.filter((l) => {
    if (!l.essayId || seen.has(l.essayId)) return false
    seen.add(l.essayId)
    return true
  })
  await syncRows("application_essays", userId, applicationId, clean, (row) => ({
    essay_id: row.essayId,
    ai_rules_note: row.aiRulesNote || null,
  }))
  return clean
}

/* Academic library (owner-scoped; no public query paths). Payloads use DB
   column names. Whitelists prevent accidentally changing ownership or metadata. */
const ACADEMIC_COLUMNS = {
  education_entries: 'entry_type institution_name country city ceeb_code language_of_instruction start_date end_date is_current qualification grading_scale overall_average scale_maximum class_rank class_size school_does_not_rank current_year_courses predicted_grades mid_year_grades school_counselor_name school_counselor_email school_counselor_phone degree major minor gpa gpa_scale credits_completed honours_classification rank_percentile thesis_title thesis_supervisor thesis_abstract credential_eval_status credential_eval_provider credential_eval_number sort_order',
  test_attempts: 'test_type status attempt_number test_date overall_score overall_max trf_number is_home_edition is_mybest national_exam_name expires_on is_best notes report_document_id',
  honors: 'title levels grade_levels received_month received_year category result subject issuer participants_context description certificate_document_id verification_url is_top5_commonapp top5_order sort_order',
  activities: 'activity_type position organization_name description long_description grade_levels timing hours_per_week weeks_per_year start_date end_date ongoing city country participation_mode impact_metrics supervisor_name supervisor_email is_paid employment_type industry earnings_for_family research_mentor research_institution research_question output_status plan_to_continue sort_order',
  projects: 'title project_type role_type team_size my_contribution start_date end_date status problem method result result_metrics tech_tags github_url demo_url video_url paper_url report_document_id mentor_name related_activity_id related_honor_id visibility short_description link',
  publications: 'title authors my_author_position venue pub_year doi_url pub_type peer_reviewed status pdf_document_id',
  grade_rows: 'subject grade_level semester grade is_predicted sort_order',
  test_section_scores: 'section score score_max sort_order',
  score_sending: 'application_id attempt_id requirement self_reported official_sent sent_on delivery_confirmed',
}

function academicFields(table, row) {
  return Object.fromEntries(ACADEMIC_COLUMNS[table].split(' ')
    .filter((key) => Object.hasOwn(row, key))
    .map((key) => [key, row[key]]))
}

export async function fetchAcademicLibrary(userId) {
  const tables = Object.keys(ACADEMIC_COLUMNS)
  const results = await Promise.all(tables.map((table) =>
    supabase.from(table).select('*').eq('user_id', userId)))
  for (const result of results) if (result.error) throw result.error
  return Object.fromEntries(tables.map((table, index) => [table, results[index].data || []]))
}

async function saveAcademicRow(table, userId, row) {
  const fields = academicFields(table, row)
  if (table === 'projects' && fields.role_type === 'team' && !String(fields.my_contribution || '').trim()) {
    throw new Error('Describe your contribution to the team project.')
  }
  const query = row.id
    ? supabase.from(table).update(fields).eq('id', row.id).eq('user_id', userId)
    : supabase.from(table).insert({ ...fields, user_id: userId })
  const { data, error } = await query.select().single()
  if (error) throw error
  notifyDataChanged()
  return data
}

export const saveEducationEntry = (userId, row) => saveAcademicRow('education_entries', userId, row)
export const saveTestAttempt = (userId, row) => saveAcademicRow('test_attempts', userId, {
  ...row,
  ...(Object.hasOwn(row, 'test_type') && Object.hasOwn(row, 'test_date')
    ? { expires_on: scoreExpiryDate(row.test_type, row.test_date) } : {}),
})
export const saveHonor = (userId, row) => saveAcademicRow('honors', userId, row)
export const saveActivity = (userId, row) => saveAcademicRow('activities', userId, row)
export const saveProject = (userId, row) => saveAcademicRow('projects', userId, row)
export const savePublication = (userId, row) => saveAcademicRow('publications', userId, row)

export async function saveScoreSending(userId, row) {
  const fields = academicFields('score_sending', row)
  const { data, error } = await supabase.from('score_sending')
    .upsert({ ...fields, user_id: userId }, { onConflict: 'application_id,attempt_id' })
    .select().single()
  if (error) throw error
  notifyDataChanged()
  return data
}

async function syncAcademicRows(table, parentKey, userId, parentId, rows) {
  const ids = await syncRows(table, userId, parentId, rows,
    (row, index) => ({ ...academicFields(table, row), sort_order: row.sort_order ?? index }), parentKey)
  notifyDataChanged()
  return ids
}
export const syncGradeRows = (userId, entryId, rows = []) => syncAcademicRows('grade_rows', 'entry_id', userId, entryId, rows)
export async function syncSectionScores(userId, attemptId, rows = []) {
  const { data, error } = await supabase.from('test_attempts').select('test_type').eq('id', attemptId).eq('user_id', userId).single()
  if (error) throw error
  if (data.test_type === 'SAT' && rows.some((row) => !isValidSatSectionScore(row.score))) {
    throw new Error('SAT section scores must be 200–800 in steps of 10.')
  }
  return syncAcademicRows('test_section_scores', 'attempt_id', userId, attemptId, rows)
}

export async function deleteAcademicRow(table, userId, id) {
  if (!Object.hasOwn(ACADEMIC_COLUMNS, table)) throw new Error('Invalid academic table')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyDataChanged()
}
export const deleteEducationEntry = (userId, id) => deleteAcademicRow('education_entries', userId, id)

/** One-time import. Call only after the DB-backed UI is ready. Original keys
 * remain as a backup. A persisted per-item UUID ledger makes retries safe when
 * an earlier request succeeded but its response was lost. */
export async function importLegacyAcademicLibrary(userId, storage = globalThis.localStorage) {
  const flagKey = `apptrack.academic_migrated.${userId}`
  const ledgerKey = `apptrack.academic_migration_ids.${userId}`
  if (storage.getItem(flagKey) === '1') return 0
  const tableByKind = {
    education: 'education_entries', test_scores: 'test_attempts', honors: 'honors',
    volunteering: 'activities', experience: 'activities', projects: 'projects',
  }
  const ledger = JSON.parse(storage.getItem(ledgerKey) || '{}')
  const snapshot = {}
  const batches = {}
  let count = 0
  for (const [kind, table] of Object.entries(tableByKind)) {
    const raw = storage.getItem(`apptrack.${kind}.${userId}`)
    snapshot[kind] = raw
    if (raw === null) continue
    const items = JSON.parse(raw)
    if (!Array.isArray(items) || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new Error(`Could not import ${kind}: saved data is invalid. Your original data was retained.`)
    }
    items.forEach((item, index) => {
      const key = JSON.stringify([kind, index, item])
      const id = ledger[key] || newApplicationRowId()
      ledger[key] = id
      ;(batches[table] ||= []).push({ ...mapLegacyAcademicItem(kind, item), id, user_id: userId })
      count += 1
    })
  }
  // If storage is unavailable, abort before any writes rather than risk duplicates.
  storage.setItem(ledgerKey, JSON.stringify(ledger))
  for (const [table, rows] of Object.entries(batches)) {
    if (!rows.length) continue
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  for (const [kind, original] of Object.entries(snapshot)) {
    if (storage.getItem(`apptrack.${kind}.${userId}`) !== original) {
      throw new Error('Saved academic items changed during import. Please retry.')
    }
  }
  storage.setItem(flagKey, '1')
  if (count) notifyDataChanged()
  return count
}
