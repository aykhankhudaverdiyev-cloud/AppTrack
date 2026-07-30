import { supabase } from '../lib/supabase'
import { normalizeDocuments, uploadStorageFile, removeStorageFile, extractStoragePath } from '../lib/storage'

function normalizeApplicationRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    student_id: row.student_id,
    university: row.university || '',
    program: row.program || '',
    major: row.major || '',
    term: row.term || '',
    deadline: row.deadline || '',
    status: row.status || 'Not Started',
    decision: row.decision || 'Pending',
    recommendation: row.recommendation || 'Pending',
    notes: row.notes || '',
    visibility: row.visibility || 'private',
    created_at: row.created_at,
    documents: row.documents || {},
  }
}

function groupDocumentsByCategory(rows = []) {
  return rows.reduce((acc, row) => {
    const key = row.category || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})
}

export async function getMyApplications(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      application_documents (
        id,
        application_id,
        user_id,
        category,
        name,
        file_url,
        file_path,
        size,
        visibility,
        created_at
      )
    `)
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const mapped = await Promise.all(
    (data || []).map(async (app) => {
      const normalizedDocs = await normalizeDocuments(app.application_documents || [])
      return normalizeApplicationRow({
        ...app,
        documents: groupDocumentsByCategory(normalizedDocs),
      })
    }),
  )

  return mapped
}

export async function createApplication(userId, payload) {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      student_id: userId,
      university: payload.university || '',
      program: payload.program || '',
      major: payload.major || '',
      term: payload.term || '',
      deadline: payload.deadline || null,
      status: payload.status || 'Not Started',
      decision: payload.decision || 'Pending',
      recommendation: payload.recommendation || 'Pending',
      notes: payload.notes || '',
      visibility: payload.visibility || 'private',
    })
    .select()
    .single()

  if (error) throw error

  return normalizeApplicationRow({
    ...data,
    documents: {},
  })
}

export async function updateApplication(userId, applicationId, payload) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      university: payload.university || '',
      program: payload.program || '',
      major: payload.major || '',
      term: payload.term || '',
      deadline: payload.deadline || null,
      status: payload.status || 'Not Started',
      decision: payload.decision || 'Pending',
      recommendation: payload.recommendation || 'Pending',
      notes: payload.notes || '',
      visibility: payload.visibility || 'private',
    })
    .eq('id', applicationId)
    .eq('student_id', userId)
    .select(`
      *,
      application_documents (
        id,
        application_id,
        user_id,
        category,
        name,
        file_url,
        file_path,
        size,
        visibility,
        created_at
      )
    `)
    .single()

  if (error) throw error

  const normalizedDocs = await normalizeDocuments(data.application_documents || [])

  return normalizeApplicationRow({
    ...data,
    documents: groupDocumentsByCategory(normalizedDocs),
  })
}

export async function deleteApplication(userId, applicationId) {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', applicationId)
    .eq('student_id', userId)

  if (error) throw error
}

export async function updateApplicationVisibility(userId, applicationId, visibility) {
  const { data, error } = await supabase
    .from('applications')
    .update({ visibility })
    .eq('id', applicationId)
    .eq('student_id', userId)
    .select()
    .single()

  if (error) throw error

  return normalizeApplicationRow({
    ...data,
    documents: {},
  })
}

export async function createApplicationDocument(userId, payload) {
  const { data, error } = await supabase
    .from('application_documents')
    .insert({
      user_id: userId,
      application_id: payload.application_id,
      category: payload.category || 'other',
      name: payload.name || 'Document',
      file_path: payload.file_path || '',
      file_url: payload.file_url || '',
      size: payload.size || 0,
      visibility: payload.visibility || 'private',
    })
    .select()
    .single()

  if (error) throw error

  // Normalize the returned document to ensure clean paths and signed URLs
  const [normalized] = await normalizeDocuments([data])

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

export async function deleteApplicationDocument(userId, documentId) {
  const { error } = await supabase
    .from('application_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function updateApplicationDocumentVisibility(userId, documentId, visibility) {
  const { data, error } = await supabase
    .from('application_documents')
    .update({ visibility })
    .eq('id', documentId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  const [normalized] = await normalizeDocuments([data])

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