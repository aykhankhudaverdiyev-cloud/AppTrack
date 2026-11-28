/** ============================================================================
 * documentsApi.js — every read/write of the student document library
 * ============================================================================
 * Two tables, one entry point:
 *   public.document_files   the file itself (title, category, storage path)
 *   public.item_documents   where that file is attached (education / test /
 *                           honor / project item), one row per link
 *
 * The four legacy single-document columns (transcript_document_id,
 * report_document_id, certificate_document_id) are no longer read or written by
 * the app; migration 012 copied their values into item_documents.
 *
 * Storage: bucket `student-documents` (private, owner-only policies).
 * Upload path: {user_id}/{uuid}-{safe-file-name}. PDF / JPG / PNG, ≤ 10 MB.
 * Viewing uses a signed URL (60 s).
 * ============================================================================ */

import { supabase } from '../lib/supabase'
import { createSignedFileUrl, removeStorageFile } from '../lib/storage'
import { notifyDataChanged } from '../store/studentsStore'

const BUCKET = 'student-documents'
const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = { 'application/pdf': true, 'image/jpeg': true, 'image/png': true, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true }

/** Sections that can hold proof files. Must match the DB check constraint. */
export const DOCUMENT_SECTIONS = ['education', 'test', 'honor', 'project', 'activity']

export const DOCUMENT_CATEGORIES = {
  transcript: 'Transcript',
  translated_transcript: 'Translated transcript',
  test_report: 'Test report',
  english_certificate: 'English certificate',
  award_certificate: 'Award certificate',
  course_certificate: 'Course certificate',
  diploma: 'Diploma',
  enrollment_certificate: 'Enrollment certificate',
  predicted_grades: 'Predicted grades',
  cv_resume: 'CV / résumé',
  essay_export: 'Essay',
  portfolio: 'Portfolio',
  research_proposal: 'Research proposal',
  writing_sample: 'Writing sample',
  university_form: 'University form',
  recommendation_copy: 'Recommendation copy',
  other: 'Other',
}

/** The category a section defaults to, and what it offers first in the modal. */
export const SECTION_CATEGORIES = {
  education: ['transcript', 'translated_transcript', 'predicted_grades', 'enrollment_certificate', 'diploma', 'other'],
  test: ['test_report', 'english_certificate', 'other'],
  honor: ['award_certificate', 'course_certificate', 'other'],
  project: ['portfolio', 'research_proposal', 'writing_sample', 'other'],
  activity: ['award_certificate', 'course_certificate', 'portfolio', 'other'],
  library: Object.keys(DOCUMENT_CATEGORIES),
}

function safeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 120)
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

/** Human file size: "820 KB", "1.4 MB". */
export function formatSize(bytes) {
  const size = Number(bytes)
  if (!size || size < 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function validateDocumentFile(file) {
  if (!Object.hasOwn(ACCEPTED, file.type)) return 'Choose a PDF, JPG, PNG or DOCX file.'
  if (file.size > MAX_SIZE) return 'Choose a file that is 10 MB or smaller.'
  return ''
}

/* ---------------------------------------------------------------------------
 * The library
 * ------------------------------------------------------------------------- */

/** Every file the student owns, newest first. */
export async function listDocuments(userId) {
  if (!userId) return []
  return unwrap(await supabase
    .from('document_files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })) || []
}

/** A single file by id (null when it was deleted). */
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

const baseName = (name) => String(name || '').trim().toLowerCase().replace(/\.[a-z0-9]{1,5}$/, '')

/**
 * The same file the student already uploaded: same name (with or without the
 * extension — the stored title has none) and the same size in bytes.
 */
export function findDuplicate(documents = [], file) {
  if (!file) return null
  const name = baseName(file.name)
  if (!name) return null
  if (file.size == null) return null
  const size = Number(file.size)
  return documents.find((doc) => baseName(doc.title) === name
    && doc.size_bytes != null && Number(doc.size_bytes) === size) || null
}

/**
 * Upload bytes + create the document_files row.
 * `onProgress(percent)` is called as the upload advances (browsers report it
 * when the request can be tracked; otherwise just 0 → 100).
 */
export async function uploadDocument(userId, { file, title, category }, onProgress) {
  if (!userId) throw new Error('userId is required')
  if (!category) throw new Error('category is required')
  if (!file) throw new Error('No file selected')
  const invalid = validateDocumentFile(file)
  if (invalid) throw new Error(invalid)

  const filePath = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  onProgress?.(0)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/pdf',
  })
  if (uploadError) throw uploadError
  onProgress?.(100)

  try {
    const row = unwrap(await supabase
      .from('document_files')
      .insert({
        user_id: userId,
        title: String(title || file.name || 'Document').slice(0, 200),
        category,
        file_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
        is_public: false,
      })
      .select()
      .single())
    notifyDataChanged()
    return row
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

/** Open a signed URL in a new tab (pop-up blocker aware). */
export async function openDocument(doc) {
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  try {
    const url = await documentUrl(doc?.file_path, 60)
    if (!url) throw new Error('Missing URL')
    if (popup) popup.location.replace(url)
    else throw new Error('Popup blocked')
  } catch (cause) {
    popup?.close()
    throw cause
  }
}

/* ---------------------------------------------------------------------------
 * Links between a file and an item
 * ------------------------------------------------------------------------- */

/** Attach a file to one item. Re-linking the same file is a no-op. */
export async function linkDocument(userId, section, itemId, documentId) {
  if (!userId || !itemId || !documentId) throw new Error('Missing ids')
  if (!DOCUMENT_SECTIONS.includes(section)) throw new Error('Unknown section')
  const { error } = await supabase
    .from('item_documents')
    .insert({ user_id: userId, section, item_id: itemId, document_id: documentId })
  if (error && error.code !== '23505') throw error
  notifyDataChanged()
}

export async function unlinkDocument(section, itemId, documentId) {
  unwrap(await supabase
    .from('item_documents')
    .delete()
    .eq('section', section)
    .eq('item_id', itemId)
    .eq('document_id', documentId))
  notifyDataChanged()
}

/**
 * The files of one item, newest link first, as document_files rows.
 * Two plain queries instead of an embedded join: the app never depends on
 * PostgREST's relationship cache, and a file deleted elsewhere simply
 * disappears from the list.
 */
export async function listItemDocuments(section, itemId) {
  if (!section || !itemId) return []
  const links = unwrap(await supabase
    .from('item_documents')
    .select('document_id, created_at')
    .eq('section', section)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })) || []
  const ids = links.map((link) => link.document_id)
  if (!ids.length) return []
  const files = unwrap(await supabase
    .from('document_files')
    .select('*')
    .in('id', ids)) || []
  const byId = new Map(files.map((file) => [file.id, file]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

/** The title of every item that can hold files, per section. */
const ITEM_TITLE_COLUMNS = {
  education: ['education_entries', 'institution_name'],
  test: ['test_attempts', 'test_type'],
  honor: ['honors', 'title'],
  project: ['projects', 'title'],
  activity: ['activities', 'position'],
  application: ['applications', 'university'],
}

async function itemTitles(idsBySection) {
  const titles = {}
  await Promise.all(Object.entries(idsBySection).map(async ([section, ids]) => {
    const config = ITEM_TITLE_COLUMNS[section]
    if (!config || !ids.length) return
    const [table, column] = config
    const rows = unwrap(await supabase.from(table).select(`id, ${column}`).in('id', ids)) || []
    for (const row of rows) titles[`${section}:${row.id}`] = row[column]
  }))
  return titles
}

/**
 * Every link of the student, grouped per item:
 *   { 'education:<id>': [{ key, section, itemTitle, documents: [...] }] }
 * plus `documentsByItem` for the Documents page ("where is this file used").
 */
export async function listAllLinks(userId) {
  if (!userId) return {}
  const links = unwrap(await supabase
    .from('item_documents')
    .select('section, item_id, document_id, created_at')
    .eq('user_id', userId)) || []
  const applicationLinks = unwrap(await supabase
    .from('document_links')
    .select('application_id, document_id, label, created_at')
    .eq('user_id', userId)) || []
  const allLinks = [...links, ...applicationLinks.map((link) => ({ ...link, section: 'application', item_id: link.application_id }))]
  const fileIds = [...new Set(allLinks.map((link) => link.document_id))]
  const files = fileIds.length
    ? unwrap(await supabase.from('document_files').select('id, title, created_at').in('id', fileIds)) || []
    : []
  const fileById = new Map(files.map((file) => [file.id, file]))
  const idsBySection = {}
  for (const link of allLinks) (idsBySection[link.section] ||= []).push(link.item_id)
  const titles = await itemTitles(Object.fromEntries(
    Object.entries(idsBySection).map(([section, ids]) => [section, [...new Set(ids)]]),
  ))
  const grouped = {}
  for (const link of allLinks) {
    const key = `${link.section}:${link.item_id}${link.section === 'application' ? `:${link.label || ''}` : ''}`
    grouped[key] ||= {
      key,
      section: link.section,
      itemTitle: [titles[`${link.section}:${link.item_id}`], link.section === 'application' ? link.label : ''].filter(Boolean).join(' · '),
      documents: [],
    }
    grouped[key].documents.push(fileById.get(link.document_id) || { id: link.document_id, title: 'Document' })
  }
  return grouped
}

/* ---------------------------------------------------------------------------
 * Usage + delete (same action on every screen)
 * ------------------------------------------------------------------------- */

const SECTION_LABELS = {
  education: 'Education', test: 'Test Scores', honor: 'Honors',
  project: 'Projects', activity: 'Activities', application: 'Applications',
}

/** Locations returned by the database, used before a permanent delete. */
export async function documentUsage(documentId) {
  const rows = unwrap(await supabase.rpc('document_usage', { p_document_id: documentId })) || []
  return { total: rows.length, items: rows }
}

export function usageSentence(usage, title = 'This file') {
  if (!usage?.total) return `${title} is not attached anywhere.`
  const places = usage.items.map((item) => `${SECTION_LABELS[item.section] || item.section} · ${item.title || 'Untitled'}`)
  return `${title} is attached in ${usage.total} ${usage.total === 1 ? 'place' : 'places'}: ${places.join(', ')}.`
}

/**
 * Delete a file everywhere. The database returns the storage path it removed
 * and the client removes the object afterwards (a failed object delete is
 * logged only — the row is already gone, so the file is orphaned, not lost).
 */
export async function deleteDocumentEverywhere(documentId) {
  const paths = unwrap(await supabase.rpc('delete_document', { p_document_id: documentId })) || []
  for (const path of paths) {
    await removeStorageFile(path).catch((error) => {
      console.warn('Storage object not removed:', path, error?.message)
    })
  }
  notifyDataChanged()
  return paths
}

/** Back-compat helper: delete one row + its object (no link cleanup). */
export async function deleteDocument(userId, documentFile) {
  await unwrap(await supabase
    .from('document_files')
    .delete()
    .eq('id', documentFile.id)
    .eq('user_id', userId))
  await removeStorageFile(documentFile.file_path).catch(() => {})
  notifyDataChanged()
}
