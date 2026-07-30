import { useState, useEffect } from "react"
import "./VisibilityToggle.css"

export default function NotificationsDrawer({
  open,
  onClose,
  notifications,
  settings,
  onToggleSetting,
  onApproveRequest,
  onDeclineRequest,
  onMarkRead,
  onClearResolved,
}) {
  const [expandedNotifications, setExpandedNotifications] = useState({})

  useEffect(() => {
    if (open) {
      const expanded = {}
      notifications.forEach((n) => {
        if (n.status === "pending" || n.status === "unread") {
          expanded[n.id] = true
        }
      })
      setExpandedNotifications(expanded)
    } else {
      setExpandedNotifications({})
    }
  }, [open, notifications])

  if (!open) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer drawer--right" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h3>Notifications</h3>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer__body">
          {/* Settings */}
          <div className="notif-settings">
            <h4>Notification Preferences</h4>
            {settings.map((setting) => (
              <div key={setting.key} className="notif-pref">
                <span className="notif-pref__icon">{setting.emoji}</span>
                <div className="notif-pref__text">
                  <strong>{setting.label}</strong>
                  <small>{setting.hint}</small>
                </div>
                <button
                  type="button"
                  className={`switch ${setting.enabled ? "switch--on" : ""}`}
                  onClick={() => onToggleSetting(setting.key)}
                  title={setting.enabled ? "Enabled" : "Disabled"}
                >
                  <span className="switch__dot" />
                </button>
              </div>
            ))}
          </div>

          {/* Inbox */}
          <div className="notif-inbox">
            <div className="drawer-section-head">
              <h4>Inbox</h4>
              {notifications.filter((n) => n.status === "pending" || n.status === "unread").length > 0 && (
                <button
                  type="button"
                  className="mini-btn mini-btn--muted"
                  onClick={onClearResolved}
                >
                  Clear resolved
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="empty-state empty-state--cert">
                <div className="empty-state__icon">🔔</div>
                <h4>No notifications</h4>
                <p>You are all caught up!</p>
              </div>
            ) : (
              <div className="notif-list">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notif-item notif-item--${notif.status}`}
                  >
                    <span className="notif-item__icon">
                      {notif.type === "visibility_request"
                        ? "👤"
                        : notif.type === "deadline"
                        ? "⏳"
                        : notif.type === "recommendation_declined"
                        ? "✉️"
                        : "⚠️"}
                    </span>
                    <div className="notif-item__body">
                      <div className="notif-item__top">
                        <strong>{notif.student_name || "System"}</strong>
                        <span className="vis-chip vis-chip--slate">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="notif-item__msg">{notif.message}</p>
                      {notif.status === "pending" && notif.field && (
                        <div className="notif-item__actions">
                          <span className="vis-chip">
                            Current: {notif.current_visibility}
                          </span>
                          <span className="vis-chip vis-chip--public">
                            Requested: {notif.requested_visibility}
                          </span>
                          <div className="notif-item__buttons">
                            <button
                              type="button"
                              className="mini-btn mini-btn--success"
                              onClick={() => onApproveRequest(notif.id)}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="mini-btn mini-btn--danger"
                              onClick={() => onDeclineRequest(notif.id)}
                            >
                              ✕ Decline
                            </button>
                          </div>
                        </div>
                      )}
                      {notif.status === "read" && (
                        <small className="notif-item__meta">
                          Marked read on {new Date(notif.created_at).toLocaleDateString()}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

