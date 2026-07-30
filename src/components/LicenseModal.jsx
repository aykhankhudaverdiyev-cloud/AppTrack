import { useState, useEffect } from "react"

export default function LicenseModal({ open, studentId, license, onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    issueMonth: "",
    issueYear: "",
    expireMonth: "",
    expireYear: "",
    credentialId: "",
    credentialUrl: "",
    score: "",
    visibility: "private",
  })
  const [saving, setSaving] = useState(false)

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const YEARS = Array.from({ length: 30 }, (_, i) => 2030 - i).map(String)

  useEffect(() => {
    if (license) {
      setForm({
        name: license.name || "",
        issuer: license.issuer || "",
        issueMonth: license.issueMonth || "",
        issueYear: license.issueYear || "",
        expireMonth: license.expireMonth || "",
        expireYear: license.expireYear || "",
        credentialId: license.credentialId || "",
        credentialUrl: license.credentialUrl || "",
        score: license.score || "",
        visibility: license.visibility || "private",
      })
    } else {
      setForm({
        name: "",
        issuer: "",
        issueMonth: "",
        issueYear: "",
        expireMonth: "",
        expireYear: "",
        credentialId: "",
        credentialUrl: "",
        score: "",
        visibility: "private",
      })
    }
  }, [license, open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, id: license?.id })
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setSaving(false)
    }
  }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">Licenses & Certifications</p>
            <h3>{license ? "Edit Certification" : "Add Certification"}</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label className="field">
            <span>Name *</span>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. IELTS Academic"
              required
            />
          </label>

          <label className="field">
            <span>Issuing Organization</span>
            <input
              value={form.issuer}
              onChange={(e) => set("issuer", e.target.value)}
              placeholder="e.g. British Council"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Issue Month</span>
              <select value={form.issueMonth} onChange={(e) => set("issueMonth", e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Issue Year</span>
              <select value={form.issueYear} onChange={(e) => set("issueYear", e.target.value)}>
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Expiry Month</span>
              <select value={form.expireMonth} onChange={(e) => set("expireMonth", e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Expiry Year</span>
              <select value={form.expireYear} onChange={(e) => set("expireYear", e.target.value)}>
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Credential ID</span>
              <input
                value={form.credentialId}
                onChange={(e) => set("credentialId", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="field">
              <span>Score</span>
              <input
                value={form.score}
                onChange={(e) => set("score", e.target.value)}
                placeholder="e.g. 7.5"
              />
            </label>
          </div>

          <label className="field">
            <span>Credential URL</span>
            <input
              value={form.credentialUrl}
              onChange={(e) => set("credentialUrl", e.target.value)}
              placeholder="https://"
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
              {saving ? "Saving..." : license ? "Save changes" : "Add certification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
