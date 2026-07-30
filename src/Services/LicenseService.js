import { supabase } from '../lib/supabase'
import { normalizeDocuments, createSignedFileUrl, uploadStorageFile, removeStorageFile } from '../lib/storage'

function normalizeLicenseRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || '',
    issuer: row.issuer || '',
    issueMonth: row.issue_month || '',
    issueYear: row.issue_year || '',
    expireMonth: row.expire_month || '',
    expireYear: row.expire_year || '',
    credentialId: row.credential_id || '',
    credentialUrl: row.credential_url || '',
    score: row.score || '',
    visibility: row.visibility || 'private',
    media: row.media || [],
    created_at: row.created_at,
  }
}

export async function getMyLicenses(userId) {
  const { data, error } = await supabase
    .from('licenses')
    .select(`
      *,
      license_media (
        id,
        license_id,
        name,
        file_path,
        file_url,
        size,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const mapped = await Promise.all(
    (data || []).map(async (item) => {
      // Normalize license_media using the same document normalizer
      const normalizedMedia = await normalizeDocuments(
        (item.license_media || []).map((m) => ({
          ...m,
          application_id: m.license_id,
          user_id: item.user_id,
          category: 'license',
          visibility: 'private',
        }))
      )

      const media = normalizedMedia.map((m) => ({
        id: m.id,
        license_id: m.application_id,
        name: m.name || 'Document',
        filePath: m.file_path || '',
        url: m.file_url || '',
        size: m.size || 0,
        created_at: m.created_at,
      }))

      return normalizeLicenseRow({
        ...item,
        media,
      })
    }),
  )

  return mapped
}

export async function createLicense(userId, payload) {
  const { data, error } = await supabase
    .from('licenses')
    .insert({
      user_id: userId,
      name: payload.name || '',
      issuer: payload.issuer || '',
      issue_month: payload.issueMonth || '',
      issue_year: payload.issueYear || '',
      expire_month: payload.expireMonth || '',
      expire_year: payload.expireYear || '',
      credential_id: payload.credentialId || '',
      credential_url: payload.credentialUrl || '',
      score: payload.score || '',
      visibility: payload.visibility || 'private',
    })
    .select()
    .single()

  if (error) throw error

  return normalizeLicenseRow({
    ...data,
    media: [],
  })
}

export async function updateLicense(userId, licenseId, payload) {
  const { data, error } = await supabase
    .from('licenses')
    .update({
      name: payload.name || '',
      issuer: payload.issuer || '',
      issue_month: payload.issueMonth || '',
      issue_year: payload.issueYear || '',
      expire_month: payload.expireMonth || '',
      expire_year: payload.expireYear || '',
      credential_id: payload.credentialId || '',
      credential_url: payload.credentialUrl || '',
      score: payload.score || '',
      visibility: payload.visibility || 'private',
    })
    .eq('id', licenseId)
    .eq('user_id', userId)
    .select(`
      *,
      license_media (
        id,
        license_id,
        name,
        file_path,
        file_url,
        size,
        created_at
      )
    `)
    .single()

  if (error) throw error

  const normalizedMedia = await normalizeDocuments(
    (data.license_media || []).map((m) => ({
      ...m,
      application_id: m.license_id,
      user_id: userId,
      category: 'license',
      visibility: 'private',
    }))
  )

  const media = normalizedMedia.map((m) => ({
    id: m.id,
    license_id: m.application_id,
    name: m.name || 'Document',
    filePath: m.file_path || '',
    url: m.file_url || '',
    size: m.size || 0,
    created_at: m.created_at,
  }))

  return normalizeLicenseRow({
    ...data,
    media,
  })
}

export async function deleteLicense(userId, licenseId) {
  const { error } = await supabase
    .from('licenses')
    .delete()
    .eq('id', licenseId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function updateLicenseVisibility(userId, licenseId, visibility) {
  const { data, error } = await supabase
    .from('licenses')
    .update({ visibility })
    .eq('id', licenseId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return normalizeLicenseRow({
    ...data,
    media: [],
  })
}

export async function createLicenseMedia(userId, payload) {
  const { data, error } = await supabase
    .from('license_media')
    .insert({
      user_id: userId,
      license_id: payload.license_id,
      name: payload.name || 'Document',
      file_path: payload.file_path || '',
      file_url: payload.file_url || '',
      size: payload.size || 0,
    })
    .select()
    .single()

  if (error) throw error

  const [normalized] = await normalizeDocuments([{
    ...data,
    application_id: data.license_id,
    category: 'license',
    visibility: 'private',
  }])

  return {
    id: normalized.id,
    license_id: normalized.application_id,
    name: normalized.name || 'Document',
    filePath: normalized.file_path || '',
    url: normalized.file_url || '',
    size: normalized.size || 0,
    created_at: normalized.created_at,
  }
}

export async function deleteLicenseMedia(userId, mediaId) {
  const { error } = await supabase
    .from('license_media')
    .delete()
    .eq('id', mediaId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Upload a license media file to storage and create a DB record.
 * This is the student-side equivalent of the store's uploadLicenseMediaFile.
 */
export async function uploadLicenseMedia(userId, licenseId, file) {
  if (!userId) throw new Error('userId is required.')
  if (!licenseId) throw new Error('licenseId is required.')
  if (!file) throw new Error('file is required.')

  // Use the shared storage helper for consistent path generation
  const uploaded = await uploadStorageFile(userId, licenseId, 'license_media', file)

  // Generate a signed URL for immediate display
  let signedUrl = ''
  try {
    signedUrl = await createSignedFileUrl(uploaded.filePath)
  } catch (error) {
    console.error('Failed to create signed URL:', error)
  }

  const insertPayload = {
    user_id: userId,
    license_id: licenseId,
    name: uploaded.fileName,
    file_path: uploaded.filePath,
    file_url: signedUrl,
    size: uploaded.size || 0,
  }

  const { data, error } = await supabase
    .from('license_media')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    await removeStorageFile(uploaded.filePath).catch(() => {})
    throw error
  }

  const [normalized] = await normalizeDocuments([{
    ...data,
    application_id: data.license_id,
    category: 'license',
    visibility: 'private',
  }])

  return {
    id: normalized.id,
    license_id: normalized.application_id,
    name: normalized.name || 'Document',
    filePath: normalized.file_path || '',
    url: normalized.file_url || '',
    size: normalized.size || 0,
    created_at: normalized.created_at,
  }
}

/**
 * Delete a license media record and its associated storage file.
 * This is the student-side equivalent of the store's deleteLicenseMediaFile.
 */
export async function deleteLicenseMediaWithStorage(userId, mediaId) {
  if (!userId) throw new Error('userId is required.')
  if (!mediaId) throw new Error('mediaId is required.')

  // Fetch the media record to get the file_path
  const { data: existingMedia, error: fetchError } = await supabase
    .from('license_media')
    .select('id, license_id, user_id, file_path')
    .eq('id', mediaId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw fetchError

  // Delete from storage first
  if (existingMedia?.file_path) {
    await removeStorageFile(existingMedia.file_path)
  }

  // Delete the DB record
  const { error: deleteError } = await supabase
    .from('license_media')
    .delete()
    .eq('id', mediaId)

  if (deleteError) throw deleteError

  return true
}