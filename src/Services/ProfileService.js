import { supabase } from "../lib/supabase"

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export function profileToDashboardStudent(row) {
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
    assignedCounselor: row.assigned_counselor || "",
    decision: row.decision || "",
    visibility,
    isProfileCompleted: Boolean(row.is_profile_completed),
    createdAt: row.created_at || "",
  }
}

export async function updateMyProfile(userId, payload) {
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMyVisibility(userId, field, value) {
  const fieldMap = {
    profile: "profile_visibility",
    photo: "photo_visibility",
    email: "email_visibility",
    phone: "phone_visibility",
    notes: "notes_visibility",
  }

  const column = fieldMap[field]
  if (!column) {
    throw new Error("Invalid visibility field")
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      [column]: value,
    })
    .eq("id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMyPhoto(userId, { photo_url, photo_path }) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      photo_url,
      photo_path,
    })
    .eq("id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getStudentWithApplicationsAndLicenses(studentId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      applications(
        *,
        application_documents(*)
      ),
      licenses(*)
    `)
    .eq("id", studentId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getPublicStudentsForExplore() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      applications(
        id,
        university,
        program,
        major,
        term,
        deadline,
        status,
        decision,
        visibility
      ),
      licenses(
        id,
        name,
        issuer,
        issue_month,
        issue_year,
        score,
        visibility
      )
    `)
    .eq("profile_visibility", "public")

  if (error) throw error
  return data
}
