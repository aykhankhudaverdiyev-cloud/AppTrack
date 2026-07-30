import { useState, useEffect } from "react"

export default function ApplicationModal({ open, studentId, application, onClose, onSave }) {
  const [form, setForm] = useState({
    university: "",
    program: "",
    major: "",
    term: "",
    deadline: "",
    status: "Not Started",
    decision: "Pending",
    recommendation: "Pending",
    notes: "",
    visibility: "private",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (application) {
      setForm({
        university: application.university || "",
        program: application.program || "",
        major: application.major || "",
        term: application.term || "",
        deadline: application.deadline || "",
        status: application.status || "Not Started",
        decision: application.decision || "Pending",
        recommendation: application.recommendation || "Pending",
        notes: application.notes || "",
        visibility: application.visibility || "private",
      })
    } else {
      setForm({
        university: "",
        program: "",
        major: "",
        term: "",
        deadline: "",
        status: "Not Started",
        decision: "Pending",
        recommendation: "Pending",
        notes: "",
        visibility: "private",
      })
    }
  }, [application, open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, id: application?.id })
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setSaving(false)
    }
  }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const statusOptions = [
    "Not Started", "In Progress", "Submitted", "Accepted", "Rejected", "Deferred", "Waitlisted"
  ]

  const decisionOptions = ["Pending", "Accepted", "Rejected", "Deferred", "Waitlisted"]
  const recommendationOptions = ["Pending", "Submitted", "Not Required"]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">University Applications</p>
            <h3>{application ? "Edit Application" : "New Application"}</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label className="field">
            <span>University *</span>
            <input
              value={form.university}
              onChange={(e) => set("university", e.target.value)}
              required
              placeholder="University name"
            />
          </label>

          <label className="field">
            <span>Program</span>
            <input
              value={form.program}
              onChange={(e) => set("program", e.target.value)}
              placeholder="e.g. Master of Science"
            />
          </label>

          <label className="field">
            <span>Major</span>
            <input
              value={form.major}
              onChange={(e) => set("major", e.target.value)}
              placeholder="e.g. Computer Science"
            />
          </label>

          <label className="field">
            <span>Term</span>
            <input
              value={form.term}
              onChange={(e) => set("term", e.target.value)}
              placeholder="e.g. Fall 2026"
            />
          </label>

          <label className="field">
            <span>Deadline</span>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Decision</span>
            <select value={form.decision} onChange={(e) => set("decision", e.target.value)}>
              {decisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Recommendation</span>
            <select value={form.recommendation} onChange={(e) => set("recommendation", e.target.value)}>
              {recommendationOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes about this application"
            />
          </label>

          <div className="field field--inline">
            <span>Visibility</span>
            <select
              value={form.visibility}
              onChange={(e) => set("visibility", e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn" disabled={saving}>
              {saving ? "Saving..." : application ? "Save changes" : "Create application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
