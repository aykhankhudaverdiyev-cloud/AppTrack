import VisibilityChip from "./VisibilityChip"
import StatusBadge from "./StatusBadge"

export default function ApplicationCard({ application, onEdit, onDelete, onToggleExpand }) {
  const { id, university, program, major, term, deadline, status, visibility } = application

  return (
    <div className="application-card">
      <div className="application-card__head">
        <div className="application-card__top">
          <div className="application-card__top-left">
            <div className="application-card__id">
              <div className="application-card__logo">
                <span className="application-card__logo-icon">🎓</span>
              </div>
              <div className="application-card__id-text">
                <h4>{university}</h4>
                <p>{program || major || "General Application"}</p>
              </div>
            </div>
            <VisibilityChip value={visibility} />
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="application-card__top-meta">
          {term && <span>Term: {term}</span>}
          {term && deadline && <span> | </span>}
          {deadline && <span>Deadline: {deadline}</span>}
        </div>
      </div>
      <div className="application-card__actions">
        <button
          className="ghost-btn ghost-btn--sm"
          onClick={() => onToggleExpand(id)}
        >
          {application.expanded ? "Hide" : "View details"}
        </button>
        <button
          className="ghost-btn ghost-btn--sm"
          onClick={() => onEdit(application)}
        >
          Edit
        </button>
        <button
          className="ghost-btn ghost-btn--danger"
          onClick={() => onDelete(id)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
