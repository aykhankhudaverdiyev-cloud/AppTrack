import { supabase } from '../lib/supabase'

export async function getMyNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or("student_id.eq." + userId + ",student_id.is.null")
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getPendingVisibilityRequests(adminId) {
  const { data, error } = await supabase
    .from('visibility_requests')
    .select("*, student:profiles!visibility_requests_student_id_fkey(full_name)")
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createVisibilityRequest(userId, payload) {
  const { data, error } = await supabase
    .from('visibility_requests')
    .insert({
      student_id: userId,
      request_type: payload.requestType,
      record_id: payload.recordId,
      requested_visibility: payload.requestedVisibility,
      reason: payload.reason || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function approveVisibilityRequest(requestId, adminId, responseMessage) {
  const { data, error } = await supabase
    .from('visibility_requests')
    .update({
      status: 'approved',
      admin_id: adminId,
      admin_response: responseMessage,
      processed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function declineVisibilityRequest(requestId, adminId, responseMessage) {
  const { data, error } = await supabase
    .from('visibility_requests')
    .update({
      status: 'declined',
      admin_id: adminId,
      admin_response: responseMessage,
      processed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function markNotificationRead(notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true, status: 'read' })
    .eq('id', notificationId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createNotification(notification) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      type: notification.type,
      status: notification.status || 'pending',
      student_id: notification.studentId || null,
      student_name: notification.studentName || null,
      field: notification.field || null,
      current_visibility: notification.currentVisibility || null,
      requested_visibility: notification.requestedVisibility || null,
      message: notification.message,
      is_read: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) throw error
  return true
}

export async function clearResolvedNotifications() {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .or("status.eq.approved,status.eq.declined,status.eq.read")

  if (error) throw error
  return true
}
