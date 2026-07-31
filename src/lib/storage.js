import { supabase } from "../lib/supabase"

const BUCKET = "student-documents"
const AVATAR_BUCKET = "avatars"

/**
 * Check if a string looks like a full URL (http:// or https://).
 */
function isFullUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

/**
 * Strip a leading bucket name or bucket-prefixed path.
 * Example: "student-documents/abc/def.pdf" → "abc/def.pdf"
 */
function stripBucketPrefix(path) {
  if (!path) return ""
  const prefix = BUCKET + "/"
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length)
  }
  return path
}

/**
 * Extract a clean relative storage path from a potentially malformed value.
 *
 * Handles:
 * - Full URLs (https://.../student-documents/abc/def.pdf) → abc/def.pdf
 * - Bucket-prefixed paths (student-documents/abc/def.pdf) → abc/def.pdf
 * - Already clean paths (abc/def.pdf) → abc/def.pdf
 * - Empty / null → ""
 */
export function extractStoragePath(value) {
  if (!value) return ""

  const str = String(value).trim()

  // If it is a full URL, try to extract the path after the bucket name
  if (isFullUrl(str)) {
    try {
      const url = new URL(str)
      const pathname = url.pathname
      // URLs from Supabase storage look like:
      // /storage/v1/object/sign/student-documents/path/to/file
      // or /storage/v1/object/public/student-documents/path/to/file
      const signMatch = pathname.match(/\/storage\/v1\/object\/sign\/student-documents\/(.+)/)
      if (signMatch) return decodeURIComponent(signMatch[1])

      const publicMatch = pathname.match(/\/storage\/v1\/object\/public\/student-documents\/(.+)/)
      if (publicMatch) return decodeURIComponent(publicMatch[1])

      // Fallback: try to find the bucket name in the URL
      const bucketIdx = pathname.indexOf("/" + BUCKET + "/")
      if (bucketIdx !== -1) {
        return decodeURIComponent(pathname.slice(bucketIdx + BUCKET.length + 2))
      }
    } catch {
      // URL parsing failed, continue to other strategies
    }
  }

  // Strip bucket prefix if present
  return stripBucketPrefix(str)
}

/**
 * Validate that a path looks like a proper relative storage path.
 * A valid path has at least two segments: userId/...
 */
export function isValidStoragePath(path) {
  if (!path) return false
  if (isFullUrl(path)) return false
  const cleaned = stripBucketPrefix(path)
  return cleaned.split("/").length >= 2
}

/**
 * Create a signed URL for a file in the student-documents bucket.
 * @param {string} filePath - Relative storage path
 * @param {number} expiresIn - Seconds until URL expires (default 3600 = 1 hour)
 * @returns {Promise<string>} Signed URL or empty string on failure
 */
export async function createSignedFileUrl(filePath, expiresIn = 3600) {
  const cleanPath = extractStoragePath(filePath)
  if (!cleanPath) return ""

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(cleanPath, expiresIn)

    if (error) {
      console.error("createSignedFileUrl error:", error.message, "path:", cleanPath)
      return ""
    }

    return data?.signedUrl || ""
  } catch (err) {
    console.error("createSignedFileUrl exception:", err)
    return ""
  }
}

/**
 * Normalize a single document record from the database.
 * Ensures file_path is a clean relative path and file_url is a fresh signed URL.
 *
 * @param {object} doc - Raw document row from DB
 * @returns {Promise<object>} Normalized document
 */
export async function normalizeDoc(doc) {
  if (!doc) return doc

  const rawPath = doc.file_path || ""
  const cleanPath = extractStoragePath(rawPath)
  const hasValidPath = isValidStoragePath(cleanPath)

  let signedUrl = ""

  if (hasValidPath) {
    signedUrl = await createSignedFileUrl(cleanPath)
  } else if (doc.file_url && isFullUrl(doc.file_url)) {
    // Fallback: use the stored file_url if file_path is invalid
    signedUrl = doc.file_url
  }

  console.log("SIGNED URL:", signedUrl)
  console.log("FILE PATH:", cleanPath)


  return {
    id: doc.id,
    application_id: doc.application_id,
    user_id: doc.user_id,
    category: doc.category || "other",
    name: doc.name || "Document",
    file_path: hasValidPath ? cleanPath : "",
    file_url: signedUrl,
    size: doc.size || 0,
    visibility: doc.visibility || "private",
    created_at: doc.created_at || "",
  }
}

/**
 * Normalize an array of document records.
 */
export async function normalizeDocuments(docs = []) {
  return Promise.all(docs.map(normalizeDoc))
}

/**
 * Delete a file from the student-documents bucket by its storage path.
 */
export async function removeStorageFile(filePath) {
  const cleanPath = extractStoragePath(filePath)
  if (!cleanPath) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([cleanPath])

  if (error) {
    console.error("removeStorageFile error:", error.message, "path:", cleanPath)
    throw error
  }
}

/**
 * Upload a file to the student-documents bucket.
 * @param {string} userId - The user/student ID
 * @param {string} applicationId - The application ID
 * @param {string} category - Document category
 * @param {File} file - The file to upload
 * @returns {Promise<{filePath: string, fileName: string, size: number}>}
 */
export async function uploadStorageFile(userId, applicationId, category, file) {
  if (!userId) throw new Error("userId is required")
  if (!applicationId) throw new Error("applicationId is required")
  if (!category) throw new Error("category is required")
  if (!file) throw new Error("file is required")

  const ext = (file.name || "pdf").split(".").pop().toLowerCase() || "pdf"
  const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2, 10)
  const fileName = uuid + "." + ext
  const filePath = userId + "/" + applicationId + "/" + category + "/" + fileName

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/pdf",
    })

  if (uploadError) throw uploadError

  return {
    filePath,
    fileName: file.name,
    size: file.size || 0,
  }
}

/**
 * Upload an avatar image.
 */
export async function uploadAvatarFile(userId, file) {
  if (!userId) throw new Error("userId is required")
  if (!file) throw new Error("No file selected")

  const ext = (file.name || "jpg").split(".").pop().toLowerCase() || "jpg"
  const fileName = "avatar-" + Date.now() + "." + ext
  const filePath = userId + "/" + fileName

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/*",
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath)

  return {
    filePath,
    publicUrl: data?.publicUrl || "",
    fileName,
    size: file.size || 0,
  }
}

/**
 * Remove an avatar file.
 */
export async function removeAvatarFile(filePath) {
  if (!filePath) return

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove([filePath])

  if (error) throw error
}
