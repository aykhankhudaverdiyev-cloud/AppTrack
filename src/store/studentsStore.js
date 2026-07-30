import { useEffect, useState, useCallback } from "react"
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
    major: row.major || "",
    university: row.university || "",
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

function mapApplicationRow(row) {
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
  const [expandedApplications, setExpandedApplications] = useState([])
  const [appModal, setAppModal] = useState({ open: false, studentId: null, application: null })
  const [licenseModal, setLicenseModal] = useState({ open: false, studentId: null, license: null })

  const loadStudents = useCallback(async () => {
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
        .select(`
          id,
          student_id,
          university,
          program,
          major,
          term,
          deadline,
          status,
          decision,
          recommendation,
          notes,
          visibility,
          created_at
        `)
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

    setStudents(
      mergeStudentsWithApplicationsAndLicenses(
        profilesData || [],
        mergedApplications,
        mergedLicenses
      )
    )
  }, [])

  useEffect(() => {
    let active = true

    const loadStudents = async () => {
      try {
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
            .select(`
              id,
              student_id,
              university,
              program,
              major,
              term,
              deadline,
              status,
              decision,
              recommendation,
              notes,
              visibility,
              created_at
            `)
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

        setStudents(
          mergeStudentsWithApplicationsAndLicenses(
            profilesData || [],
            mergedApplications,
            mergedLicenses
          )
        )
      } catch (error) {
        console.error("Failed to load students:", error)
      } finally {
        if (active) {
          loadStudents()
        }
      }
    }

    loadStudents()

    const channel = supabase
      .channel("profiles-store-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => { loadStudents() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        () => { loadStudents() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_documents" },
        () => { loadStudents() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "licenses" },
        () => { loadStudents() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "license_media" },
        () => { loadStudents() }
      )
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
      .select(`
        id,
        student_id,
        university,
        program,
        major,
        term,
        deadline,
        status,
        decision,
        recommendation,
        notes,
        visibility,
        created_at
      `)
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
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .eq("profile_visibility", "public")
    .order("full_name", { ascending: true })
    .eq("role", "student")
    .eq("is_profile_completed", true) 

  if (profilesError) throw profilesError

  const studentIds = profilesData.map(p => p.id).filter(Boolean)
  if (studentIds.length === 0) return []

  const { data: appsData, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .in("student_id", studentIds)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })

  if (appsError) throw appsError

  const { data: licData, error: licError } = await supabase
    .from("licenses")
    .select("*")
    .in("user_id", studentIds)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })

  if (licError) throw licError

  const applicationIds = (appsData || []).map(app => app.id)

  const { data: docsData, error: docsError } = await supabase
    .from("application_documents")
    .select("*")
    .in("application_id", applicationIds)
    .eq("visibility", "public")

  if (docsError) throw docsError
  
  const docsByApplication = {}

  ;(docsData || []).forEach(doc => {
    if (!docsByApplication[doc.application_id]) {
      docsByApplication[doc.application_id] = []
    }

    docsByApplication[doc.application_id].push(doc)
  })

  const appsByStudent = {}
  (appsData || []).forEach(app => {
    if (!appsByStudent[app.student_id]) appsByStudent[app.student_id] = []
    appsByStudent[app.student_id].push(app)
  })

  const licensesByStudent = {}
  (licData || []).forEach(lic => {
    if (!licensesByStudent[lic.user_id]) licensesByStudent[lic.user_id] = []
    licensesByStudent[lic.user_id].push(lic)
  })

  return profilesData.map(profile => {
    const student = mapProfileToStudent(profile)
    student.applications = (appsByStudent[profile.id] || []).map(app => ({
      ...app,
      documents: docsByApplication[app.id] || []
    }))
    student.licenses = licensesByStudent[profile.id] || []
    return student
  })
}

export async function setApplicationVisibilityWithRequest(studentId, applicationId, visibility) {
  const request = await requestVisibilityChange(studentId, {
    requestType: "application",
    recordId: applicationId,
    requestedVisibility: visibility,
    reason: "Student requested visibility change",
  })
  return { request, pending: true }
}

export async function setLicenseVisibilityWithRequest(studentId, licenseId, visibility) {
  const request = await requestVisibilityChange(studentId, {
    requestType: "license",
    recordId: licenseId,
    requestedVisibility: visibility,
    reason: "Student requested visibility change",
  })
  return { request, pending: true }
}

export async function requestVisibilityChange(studentId, payload) {
  const { data, error } = await supabase
    .from("visibility_requests")
    .insert({
      student_id: studentId,
      request_type: payload.requestType,
      record_id: payload.recordId,
      requested_visibility: payload.requestedVisibility,
      reason: payload.reason || null,
    })
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
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
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", studentId)
    .select()
    .single()

  if (error) throw error
  notifyDataChanged()
  return data
}

export async function setPhoto(studentId, { photo_url, photo_path }) {
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

  if (payload.id) {
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
