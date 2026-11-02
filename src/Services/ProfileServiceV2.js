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
