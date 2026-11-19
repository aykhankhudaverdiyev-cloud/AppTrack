/** ============================================================================
 * documentApi.js — the only place that talks to public.document_files and the
 * student-documents bucket.
 * ============================================================================
 * Upload path: {user_id}/{uuid}-{safe-file-name}. PDF / JPG / PNG, ≤ 10 MB.
 * A linked document must belong to the same user (DB trigger in migration 008).
 * Viewing uses a signed URL (60 s); the bucket stays private.
 * ============================================================================ */

import { supabase } from '../lib/supabase'
import { createSignedFileUrl, removeStorageFile } from '../lib/storage'

const BUCKET = 'student-documents'
const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = { 'application/pdf': true, 'image/jpeg': true, 'image/png': true }

export const DOCUMENT_CATEGORIES = {
  award_certificate: 'Award certificate',
  test_report: 'Test report',
  english_certificate: 'English certificate',
}

function safeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 120)
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

/** All of the user's documents, optionally restricted to categories. */
export async function listDocuments(userId, categories = []) {
  let query = supabase
    .from('document_files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (categories.length) query = query.in('category', categories)
  return unwrap(await query) || []
}

export function validateDocumentFile(file) {
  if (!Object.hasOwn(ACCEPTED, file.type)) return 'Choose a PDF, JPG or PNG file.'
  if (file.size > MAX_SIZE) return 'Choose a file that is 10 MB or smaller.'
  return ''
}

/** Upload + insert a document_files row. Deletes the upload if the row fails. */
export async function uploadDocument(userId, category, file) {
  if (!userId) throw new Error('userId is required')
  if (!category) throw new Error('category is required')
  if (!file) throw new Error('No file selected')
  const invalid = validateDocumentFile(file)
  if (invalid) throw new Error(invalid)
  const filePath = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/pdf',
  })
  if (uploadError) throw uploadError

  try {
    return unwrap(await supabase
      .from('document_files')
      .insert({
        user_id: userId,
        title: file.name || 'Document',
        category,
        file_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
        is_public: false,
      })
      .select()
      .single())
  } catch (cause) {
    await removeStorageFile(filePath).catch(() => {})
    throw cause
  }
}

/** A single document_files row by id, scoped to the owner. Returns null when
 *  the id is missing/not found (e.g. was deleted) rather than throwing, since
 *  callers use this just to render a cached title/filename. */
export async function getDocument(userId, id) {
  if (!userId || !id) return null
  const { data, error } = await supabase
    .from('document_files')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data || null
}

/** Signed URL valid for 60 seconds by default. */
export async function documentUrl(filePath, expiresIn = 60) {
  if (!filePath) return ''
  return createSignedFileUrl(filePath, expiresIn)
}

/** Delete a document row and its storage object. */
export async function deleteDocument(userId, documentFile) {
  await unwrap(await supabase
    .from('document_files')
    .delete()
    .eq('id', documentFile.id)
    .eq('user_id', userId))
  await removeStorageFile(documentFile.file_path).catch(() => {})
}
