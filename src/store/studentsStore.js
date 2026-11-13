import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import {
  normalizeDocuments,
  uploadStorageFile,
  removeStorageFile,
  createSignedFileUrl,
} from "../lib/storage"

const _dataChangeListeners = new Set()

export function onDataChanged(callback) {
  _dataChangeListeners.add(callback)
  return () => _dataChangeListeners.delete(callback)
}

export function offDataChanged(callback) {
  _dataChangeListeners.delete(callback)
}

export function notifyDataChanged() {
  _dataChangeListeners.forEach((cb) => {
    try {
      cb()
    } catch (err) {
      console.error("Data change listener error:", err)
    }
  })
}

function mapProfileToStudent(row) {
  const visibility = {
    profile: row.profile_visibility || "private",
    photo: row.photo_visibility || "private",
    email: row.email_visibility || "private",
    phone: row.phone_visibility || "private",
    notes: row.notes_visibility || "private",
  }

  return {
    id: row.id,
    role: row.role || "student",
    fullName: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    intendedMajor1: row.intended_major_1 || "",
    intendedMajor2: row.intended_major_2 || "",
    gender: row.gender || "",
    photoUrl: row.photo_url || "",
    photoPath: row.photo_path || "",
    notes: row.admin_notes || "",
    assignedCounselor: row.assigned_counselor || "",
    decision: row.decision || "",
    visibility,
    isProfileCompleted: Boolean(row.is_profile_completed),
    createdAt: row.created_at || "",
    applications: Array.isArray(row.applications) ? row.applications : [],
    licenses: Array.isArray(row.licenses) ? row.licenses : [],
  }
}

/**
 * Phase 3 — additive columns on the LIVE `applications` table.
 * The owner/admin dashboards may read every column; the PUBLIC directory must
 * keep using PUBLIC_APPLICATION_COLUMNS so portal logins, applicant IDs, fee
 * and aid results can never leak through `select('*')` on public rows.
 */
export const APPLICATION_COLUMNS = [
  "id", "student_id", "user_id", "university", "program", "major", "term",
  "deadline", "status", "decision", "recommendation", "notes", "visibility",
  "created_at", "university_id", "campus", "degree_level", "term_season",
  "term_year", "deferred_entry", "platform", "round", "is_binding",
  "portal_url", "portal_email", "applicant_id", "portal_activated",
  "fee_amount", "fee_currency", "fee_waiver_requested", "fee_waiver_granted",
  "fee_paid_on", "fit", "fit_reason", "acceptance_rate", "why_courses",
  "why_professors", "why_programs", "why_links", "progress_percent",
  "decision_conditions", "decision_at", "reply_deadline_at", "reply_deadline_tz",
  "decision_letter_document_id", "committed_at", "aid_scholarship_name",
  "aid_amount", "aid_currency", "aid_period", "aid_renewal_conditions",
  "net_cost_per_year", "aid_policy", "updated_at",
].join(",")

export const PUBLIC_APPLICATION_COLUMNS = [
  "id", "student_id", "university", "program", "major", "term", "deadline",
  "status", "decision", "recommendation", "notes", "visibility", "created_at",
].join(",")

/** camelCase → snake_case whitelist (new columns only; legacy keys stay above). */
const APPLICATION_FIELD_MAP = {
  universityId: ["university_id", "uuid"],
  campus: ["campus", "text"],
  degreeLevel: ["degree_level", "text"],
  termSeason: ["term_season", "text"],
  termYear: ["term_year", "number"],
  deferredEntry: ["deferred_entry", "bool"],
  platform: ["platform", "text"],
  round: ["round", "text"],
  isBinding: ["is_binding", "bool"],
  portalUrl: ["portal_url", "text"],
  portalEmail: ["portal_email", "text"],
  applicantId: ["applicant_id", "text"],
  portalActivated: ["portal_activated", "bool"],
  feeAmount: ["fee_amount", "number"],
  feeCurrency: ["fee_currency", "text"],
  feeWaiverRequested: ["fee_waiver_requested", "bool"],
  feeWaiverGranted: ["fee_waiver_granted", "bool"],
  feePaidOn: ["fee_paid_on", "date"],
  fit: ["fit", "text"],
  fitReason: ["fit_reason", "text"],
  acceptanceRate: ["acceptance_rate", "number"],
  whyCourses: ["why_courses", "text"],
  whyProfessors: ["why_professors", "text"],
  whyPrograms: ["why_programs", "text"],
  whyLinks: ["why_links", "text"],
  progressPercent: ["progress_percent", "number"],
  decisionConditions: ["decision_conditions", "text"],
  decisionAt: ["decision_at", "timestamp"],
  replyDeadlineAt: ["reply_deadline_at", "timestamp"],
  replyDeadlineTz: ["reply_deadline_tz", "text"],
  decisionLetterDocumentId: ["decision_letter_document_id", "uuid"],
  committedAt: ["committed_at", "timestamp"],
  aidScholarshipName: ["aid_scholarship_name", "text"],
  aidAmount: ["aid_amount", "number"],
  aidCurrency: ["aid_currency", "text"],
  aidPeriod: ["aid_period", "text"],
  aidRenewalConditions: ["aid_renewal_conditions", "text"],
  netCostPerYear: ["net_cost_per_year", "number"],
  aidPolicy: ["aid_policy", "text"],
}

function normalizeApplicationValue(value, kind) {
  switch (kind) {
    case "bool":
      return Boolean(value)
    case "number": {
      if (value === "" || value === null || value === undefined) return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }
    case "date":
    case "timestamp":
    case "uuid":
    case "text":
    default:
      return value === "" || value === null || value === undefined ? null : value
  }
}

/** Map the new columns into the shape the UI uses (additive, legacy untouched). */
function mapApplicationV2(row) {
  return {
    universityId: row.university_id || null,
    campus: row.campus || "",
    degreeLevel: row.degree_level || "",
    termSeason: row.term_season || "",
    termYear: row.term_year ?? "",
    deferredEntry: Boolean(row.deferred_entry),
    platform: row.platform || "",
    round: row.round || "",
    isBinding: Boolean(row.is_binding),
    portalUrl: row.portal_url || "",
    portalEmail: row.portal_email || "",
    applicantId: row.applicant_id || "",
    portalActivated: Boolean(row.portal_activated),
    feeAmount: row.fee_amount ?? "",
    feeCurrency: row.fee_currency || "",
    feeWaiverRequested: Boolean(row.fee_waiver_requested),
    feeWaiverGranted: Boolean(row.fee_waiver_granted),
    feePaidOn: row.fee_paid_on || "",
    fit: row.fit || "",
    fitReason: row.fit_reason || "",
    acceptanceRate: row.acceptance_rate ?? "",
    whyCourses: row.why_courses || "",
    whyProfessors: row.why_professors || "",
    whyPrograms: row.why_programs || "",
    whyLinks: row.why_links || "",
    progressPercent: Number(row.progress_percent) || 0,
    decisionConditions: row.decision_conditions || "",
    decisionAt: row.decision_at || "",
    replyDeadlineAt: row.reply_deadline_at || "",
    replyDeadlineTz: row.reply_deadline_tz || "",
    decisionLetterDocumentId: row.decision_letter_document_id || "",
    committedAt: row.committed_at || "",
    aidScholarshipName: row.aid_scholarship_name || "",
    aidAmount: row.aid_amount ?? "",
    aidCurrency: row.aid_currency || "",
    aidPeriod: row.aid_period || "",
    aidRenewalConditions: row.aid_renewal_conditions || "",
    netCostPerYear: row.net_cost_per_year ?? "",
    aidPolicy: row.aid_policy || "",
    updatedAt: row.updated_at || "",
  }
}

export function mapApplicationRow(row) {
  return {
    id: row.id,
    student_id: row.student_id,
    university: row.university || "",
    program: row.program || "",
    major: row.major || "",
    term: row.term || "",
    deadline: row.deadline || "",
    status: row.status || "Not Started",
    decision: row.decision || "Pending",
    recommendation: row.recommendation || "Pending",
    notes: row.notes || "",
    visibility: row.visibility || "private",
    created_at: row.created_at || "",
    documents: row.documents || {},
    ...mapApplicationV2(row),
  }
}

function mapLicenseRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || "",
    issuer: row.issuer || "",
    issueMonth: row.issue_month || "",
    issueYear: row.issue_year || "",
    expireMonth: row.expire_month || "",
    expireYear: row.expire_year || "",
    credentialId: row.credential_id || "",
    credentialUrl: row.credential_url || "",
    score: row.score || "",
    visibility: row.visibility || "private",
    media: row.media || [],
    created_at: row.created_at || "",
  }
}


function mergeStudentsWithApplicationsAndLicenses(profiles = [], applications = [], licenses = []) {
  const appsByStudentId = applications.reduce((acc, app) => {
    const key = app.student_id
    if (!key) return acc
    if (!acc[key]) acc[key] = []
    acc[key].push(app)
    return acc
  }, {})

  const licensesByStudentId = licenses.reduce((acc, lic) => {
    const key = lic.user_id
    if (!key) return acc
    if (!acc[key]) acc[key] = []
    acc[key].push(lic)
    return acc
  }, {})

  return profiles.map((profile) => ({
    ...mapProfileToStudent(profile),
    applications: appsByStudentId[profile.id] || [],
    licenses: licensesByStudentId[profile.id] || [],
  }))
}

async function groupDocumentsByApplication(documents = []) {
  const normalized = await normalizeDocuments(documents)

  const grouped = {}

  for (const doc of normalized) {
    const appId = doc.application_id
    if (!appId) continue
    if (!grouped[appId]) grouped[appId] = {}
    const cat = doc.category || "other"
    if (!grouped[appId][cat]) grouped[appId][cat] = []
    grouped[appId][cat].push(doc)
  }

  return grouped
}

async function mergeApplicationsWithDocuments(applications = [], documents = []) {
  const groupedDocs = await groupDocumentsByApplication(documents)
  return applications.map((app) => ({
    ...app,
    documents: groupedDocs[app.id] || {},
  }))
}


function mergeLicensesWithMedia(licenses = [], media = []) {
  const mediaByLicenseId = media.reduce((acc, m) => {
    const licId = m.license_id
    if (!licId) return acc
    if (!acc[licId]) acc[licId] = []
    acc[licId].push(m)
    return acc
  }, {})

  return licenses.map((lic) => ({
    ...lic,
    media: mediaByLicenseId[lic.id] || [],
  }))
}

export function useStudents() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await getStudents()
        if (active) setStudents(data)
      } catch (error) {
        console.error("Failed to load students:", error)
      }
    }

    load()

    const channel = supabase
      .channel("profiles-store-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "application_documents" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "licenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "license_media" }, load)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  return students
}

export async function getStudents() {
  const [
    { data: profilesData, error: profilesError },
    { data: applicationsData, error: applicationsError },
    { data: documentsData, error: documentsError },
    { data: licensesData, error: licensesError },
    { data: licenseMediaData, error: licenseMediaError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .order("created_at", { ascending: false }),

    supabase
      .from("application_documents")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("license_media")
      .select("*")
      .order("created_at", { ascending: false }),
  ])

  if (profilesError) throw profilesError
  if (applicationsError) throw applicationsError
  if (documentsError) throw documentsError
  if (licensesError) throw licensesError
  if (licenseMediaError) throw licenseMediaError

  const mappedApplications = (applicationsData || []).map(mapApplicationRow)
  const mergedApplications = await mergeApplicationsWithDocuments(
    mappedApplications,
    documentsData || []
  )
  const mergedLicenses = await mergeLicensesWithMedia(
    licensesData || [],
    licenseMediaData || []
  )

  return mergeStudentsWithApplicationsAndLicenses(
    profilesData || [],
    mergedApplications,
    mergedLicenses
  )
}

export async function getPublicStudents() {
  const [
    { data: profilesData, error: profilesError },
    { data: applicationsData, error: applicationsError },
    { data: documentsData, error: documentsError },
    { data: licensesData, error: licensesError },
    { data: licenseMediaData, error: licenseMediaError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true }),

    supabase
      .from("applications")
      .select(PUBLIC_APPLICATION_COLUMNS)
      .eq("visibility", "public")
      .order("created_at", { ascending: false }),

    supabase
      .from("application_documents")
      .select("*")
      .eq("visibility", "public")
      .order("created_at", { ascending: false }),

    supabase
      .from("licenses")
      .select("*")
      .eq("visibility", "public")
      .order("created_at", { ascending: false }),

    supabase
      .from("license_media")
      .select("*")
      .order("created_at", { ascending: false }),
  ])

  if (profilesError) throw profilesError
  if (applicationsError) throw applicationsError
  if (documentsError) throw documentsError
  if (licensesError) throw licensesError
  if (licenseMediaError) throw licenseMediaError

  const mappedApplications = (applicationsData || []).map(mapApplicationRow)

  const mergedApplications = await mergeApplicationsWithDocuments(
    mappedApplications,
    documentsData || []
  )

  const mappedLicenses = (licensesData || []).map(mapLicenseRow)

  const mergedLicenses = mergeLicensesWithMedia(
    mappedLicenses,
    licenseMediaData || []
  )

  return mergeStudentsWithApplicationsAndLicenses(
    profilesData || [],
    mergedApplications,
    mergedLicenses
  )
}

export async function approveVisibilityRequest(requestId, adminId) {
  const { data: request, error: reqError } = await supabase
    .from("visibility_requests")
    .update({
      status: "approved",
      admin_id: adminId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single()

  if (reqError) throw reqError

  let updateResult
  const { student_id, request_type, record_id, requested_visibility } = request

  if (["profile", "photo", "email", "phone", "notes"].includes(request_type)) {
    const fieldMap = {
      profile: "profile_visibility",
      photo: "photo_visibility",
      email: "email_visibility",
      phone: "phone_visibility",
      notes: "notes_visibility",
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({ [fieldMap[request_type]]: requested_visibility })
      .eq("id", student_id)
      .select()
      .single()
    if (error) throw error
    updateResult = data
  } else if (request_type === "application") {
    const { data, error } = await supabase
      .from("applications")
      .update({ visibility: requested_visibility })
      .eq("id", record_id)
      .eq("student_id", student_id)
      .select()
      .single()
    if (error) throw error
    updateResult = data
  } else if (request_type === "license") {
    const { data, error } = await supabase
      .from("licenses")
      .update({ visibility: requested_visibility })
      .eq("id", record_id)
      .eq("user_id", student_id)
      .select()
      .single()
    if (error) throw error
    updateResult = data
  }

  notifyDataChanged()
  return { request, updateResult }
}

export async function declineVisibilityRequest(requestId, adminId) {
  const { data, error } = await supabase
    .from("visibility_requests")
    .update({
      status: "declined",
      admin_id: adminId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function setProfile(studentId, payload) {
  const fieldMapping = {
    fullName: "full_name",
    photoUrl: "photo_url",
    photoPath: "photo_path",
    assignedCounselor: "assigned_counselor",
    isProfileCompleted: "is_profile_completed",
    adminNotes: "admin_notes",
  }

  const mapped = {}
  for (const [key, val] of Object.entries(payload)) {
    const dbKey = fieldMapping[key] || key
    mapped[dbKey] = val
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(mapped)
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function setPhoto(studentId, photoUrlOrObj, maybePhotoPath) {
  const photo_url = typeof photoUrlOrObj === "object" && photoUrlOrObj !== null
    ? photoUrlOrObj.photo_url || photoUrlOrObj.photoUrl || ""
    : photoUrlOrObj || ""
  const photo_path = typeof photoUrlOrObj === "object" && photoUrlOrObj !== null
    ? photoUrlOrObj.photo_path || photoUrlOrObj.photoPath || ""
    : maybePhotoPath || ""

  const { data, error } = await supabase
    .from("profiles")
    .update({ photo_url, photo_path })
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function removePhoto(studentId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ photo_url: null, photo_path: null })
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function setVisibility(studentId, field, value) {
  const fieldMap = {
    profile: "profile_visibility",
    photo: "photo_visibility",
    email: "email_visibility",
    phone: "phone_visibility",
    notes: "notes_visibility",
  }

  const column = fieldMap[field]
  if (!column) throw new Error("Invalid visibility field")

  const { data, error } = await supabase
    .from("profiles")
    .update({ [column]: value })
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function updateNotes(studentId, notes) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ admin_notes: notes })
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function saveApplication(studentId, payload) {
  // Legacy columns: unchanged (AdminDashboard, public drawer, realtime and the
  // visibility-request flow all read this exact shape).
  const dataToSave = {
    student_id: studentId,
    user_id: studentId,
    university: payload.university || "",
    program: payload.program || "",
    major: payload.major || "",
    term: payload.term || "",
    deadline: payload.deadline || null,
    status: payload.status || "Not Started",
    decision: payload.decision || "Pending",
    recommendation: payload.recommendation || "Pending",
    notes: payload.notes || "",
    visibility: payload.visibility || "private",
  }

  // Phase 3 columns are ADDITIVE and only written when the caller actually
  // provides them: a legacy caller (admin quick form) can never wipe them.
  for (const [camel, [snake, kind]] of Object.entries(APPLICATION_FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(payload, camel)) {
      dataToSave[snake] = normalizeApplicationValue(payload[camel], kind)
    } else if (Object.prototype.hasOwnProperty.call(payload, snake)) {
      dataToSave[snake] = normalizeApplicationValue(payload[snake], kind)
    }
  }

  // Keep the legacy `term` text in sync with the structured season/year so old
  // views always show something meaningful (manual text still wins if empty).
  if (!dataToSave.term && payload.termSeason && payload.termYear) {
    dataToSave.term = `${payload.termSeason} ${payload.termYear}`
  }

  if (payload.id) {
    dataToSave.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from("applications")
      .update(dataToSave)
      .eq("id", payload.id)
      .eq("student_id", studentId)
      .select()
      .single()

    if (error) throw error
    notifyDataChanged()
    return mapApplicationRow(data)
  }

  const { data, error } = await supabase
    .from("applications")
    .insert(dataToSave)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return mapApplicationRow(data)
}

export async function deleteApplication(studentId, applicationId) {
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("student_id", studentId)

  if (error) throw error
  notifyDataChanged()
  return true
}

export async function setApplicationVisibility(studentId, applicationId, visibility) {
  const { data, error } = await supabase
    .from("applications")
    .update({ visibility })
    .eq("id", applicationId)
    .eq("student_id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return mapApplicationRow(data)
}

export async function uploadApplicationFile(studentId, applicationId, category, file) {
  const uploaded = await uploadStorageFile(studentId, applicationId, category, file)
  const signedUrl = await createSignedFileUrl(uploaded.filePath).catch(() => "")

  const { data, error } = await supabase
    .from("application_documents")
    .insert({
      user_id: studentId,
      application_id: applicationId,
      category: category,
      name: uploaded.fileName,
      file_path: uploaded.filePath,
      file_url: signedUrl,
      size: file.size || 0,
      visibility: "private",
    })
    .select()
    .single()

  if (error) {
    await removeStorageFile(uploaded.filePath).catch(() => {})
    throw error
  }

  const [normalized] = await normalizeDocuments([data])
  notifyDataChanged()
  return normalized
}

export async function removeApplicationFile(studentId, applicationId, category, docId) {
  const { data: existingDoc, error: fetchError } = await supabase
    .from("application_documents")
    .select("id, application_id, user_id, file_path")
    .eq("id", docId)
    .eq("user_id", studentId)
    .single()

  if (fetchError) throw fetchError

  if (existingDoc?.file_path) {
    await removeStorageFile(existingDoc.file_path)
  }

  const { error: deleteError } = await supabase
    .from("application_documents")
    .delete()
    .eq("id", docId)

  if (deleteError) throw deleteError
  notifyDataChanged()
  return true
}

export async function setApplicationDocumentVisibility(userId, documentId, visibility) {
  const { data, error } = await supabase
    .from("application_documents")
    .update({ visibility })
    .eq("id", documentId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) throw error

  const [normalized] = await normalizeDocuments([data])
  notifyDataChanged()
  return {
    id: normalized.id,
    application_id: normalized.application_id,
    category: normalized.category,
    name: normalized.name,
    file_path: normalized.file_path,
    file_url: normalized.file_url,
    size: normalized.size,
    visibility: normalized.visibility,
    created_at: normalized.created_at,
  }
}

export async function saveLicense(studentId, payload) {
  const dataToSave = {
    user_id: studentId,
    name: payload.name || "",
    issuer: payload.issuer || "",
    issue_month: payload.issueMonth || "",
    issue_year: payload.issueYear || "",
    expire_month: payload.expireMonth || "",
    expire_year: payload.expireYear || "",
    credential_id: payload.credentialId || "",
    credential_url: payload.credentialUrl || "",
    score: payload.score || "",
    visibility: payload.visibility || "private",
  }

  if (payload.id) {
    const { data, error } = await supabase
      .from("licenses")
      .update(dataToSave)
      .eq("id", payload.id)
      .eq("user_id", studentId)
      .select()
      .single()

    if (error) throw error
    notifyDataChanged()
    return mapLicenseRow(data)
  }

  const { data, error } = await supabase
    .from("licenses")
    .insert(dataToSave)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return mapLicenseRow(data)
}

export async function deleteLicense(studentId, licenseId) {
  const { error } = await supabase
    .from("licenses")
    .delete()
    .eq("id", licenseId)
    .eq("user_id", studentId)

  if (error) throw error
  notifyDataChanged()
  return true
}

export async function setLicenseVisibility(studentId, licenseId, visibility) {
  const { data, error } = await supabase
    .from("licenses")
    .update({ visibility })
    .eq("id", licenseId)
    .eq("user_id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return mapLicenseRow(data)
}

export async function uploadLicenseMediaFile(studentId, licenseId, file) {
  const uploaded = await uploadStorageFile(studentId, licenseId, "license_media", file)
  const signedUrl = await createSignedFileUrl(uploaded.filePath).catch(() => "")

  const { data, error } = await supabase
    .from("license_media")
    .insert({
      user_id: studentId,
      license_id: licenseId,
      name: uploaded.fileName,
      file_path: uploaded.filePath,
      file_url: signedUrl,
      size: file.size || 0,
    })
    .select()
    .single()

  if (error) {
    await removeStorageFile(uploaded.filePath).catch(() => {})
    throw error
  }

  const [normalized] = await normalizeDocuments([{
    ...data,
    application_id: data.license_id,
    category: "license",
    visibility: "private",
  }])

  notifyDataChanged()
  return {
    id: normalized.id,
    license_id: normalized.application_id,
    name: normalized.name || "Document",
    filePath: normalized.file_path || "",
    url: normalized.file_url || "",
    size: normalized.size || 0,
    created_at: normalized.created_at,
  }
}

export async function deleteLicenseMediaFile(studentId, mediaId) {
  const { data: existingMedia, error: fetchError } = await supabase
    .from("license_media")
    .select("id, license_id, user_id, file_path")
    .eq("id", mediaId)
    .eq("user_id", studentId)
    .single()

  if (fetchError) throw fetchError

  if (existingMedia?.file_path) {
    await removeStorageFile(existingMedia.file_path)
  }

  const { error: deleteError } = await supabase
    .from("license_media")
    .delete()
    .eq("id", mediaId)

  if (deleteError) throw deleteError
  notifyDataChanged()
  return true
}

export async function deleteStudent(studentId) {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", studentId)

  if (error) {
    console.error("deleteStudent error:", error)
    throw error
  }
  notifyDataChanged()
  return true
}
