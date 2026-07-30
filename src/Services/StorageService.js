import { supabase } from '../lib/supabase'
import {
  uploadStorageFile,
  uploadAvatarFile,
  removeAvatarFile,
  removeStorageFile,
  createSignedFileUrl,
} from '../lib/storage'

/**
 * Upload a student document (application file).
 * Delegates to the shared storage helper for consistent path generation.
 */
export async function uploadStudentDocument(userId, file, scope = 'application') {
  if (!userId) throw new Error('User id is required')
  if (!file) throw new Error('No file selected')

  // For backward compatibility: when called without applicationId,
  // we use the old path format. The new format requires applicationId.
  const ext = (file.name || 'pdf').split('.').pop().toLowerCase() || 'pdf'
  const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const fileName = `${uuid}.${ext}`
  const filePath = `${userId}/${scope}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('student-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/pdf',
    })

  if (uploadError) throw uploadError

  return {
    filePath,
    fileName: file.name,
    size: file.size || 0,
    mimeType: file.type || 'application/pdf',
  }
}

/**
 * Create a signed URL for a document.
 * Delegates to the shared storage helper which handles path normalization.
 */
export async function createDocumentSignedUrl(filePath, expiresIn = 3600) {
  return createSignedFileUrl(filePath, expiresIn)
}

/**
 * Remove a student document from storage.
 * Delegates to the shared storage helper which handles path normalization.
 */
export async function removeStudentDocument(filePath) {
  return removeStorageFile(filePath)
}

/**
 * Upload an avatar image.
 */
export async function uploadAvatar(userId, file) {
  return uploadAvatarFile(userId, file)
}

/**
 * Remove an avatar image.
 */
export async function removeAvatar(filePath) {
  return removeAvatarFile(filePath)
}