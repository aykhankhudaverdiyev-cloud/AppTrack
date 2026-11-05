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
async function syncRows(table, userId, applicationId, rows, toRow) {
  const payload = rows.map((row, index) => ({
    id: row.id || newApplicationRowId(),
    user_id: userId,
    application_id: applicationId,
    ...toRow(row, index),
  }))

  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("application_id", applicationId)
  if (fetchError) throw fetchError

  const keep = new Set(payload.map((p) => p.id))
  const stale = (existing || []).map((r) => r.id).filter((id) => !keep.has(id))
  if (stale.length) {
    const { error } = await supabase.from(table).delete().in("id", stale).eq("user_id", userId)
    if (error) throw error
  }
  if (payload.length) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" })
    if (error) throw error
  }
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
