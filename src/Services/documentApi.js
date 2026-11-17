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

/** Upload + insert a document_files row. Deletes the upload if the row fails. */
export async function uploadDocument(userId, category, file) {
  if (!userId) throw new Error('userId is required')
  if (!category) throw new Error('category is required')
  if (!file) throw new Error('No file selected')
  if (!ACCEPTED[file.type]) throw new Error('Only PDF, JPG and PNG files are allowed')
  if (file.size > MAX_SIZE) throw new Error('File must be smaller than 10 MB')

  const ext = file.name.split('.').pop().toLowerCase() || 'pdf'
  const filePath = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}.${ext}`

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
        title: file.name.replace(/\.[^/.]+$/, '') || 'Document',
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
