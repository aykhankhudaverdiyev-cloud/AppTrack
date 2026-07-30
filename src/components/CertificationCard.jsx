import VisibilityChip from "./VisibilityChip"

export default function CertificationCard({ license, onEdit, onDelete }) {
  const { id, name, issuer, issueMonth, issueYear, expireMonth, expireYear, credentialId, score, visibility, media = [] } = license

  const issueDate = [issueMonth, issueYear].filter(Boolean).join(" ")
  const expireDate = [expireMonth, expireYear].filter(Boolean).join(" ")

  return (
    <div className="certification-card">
      <div className="certification-card__head">
        <div className="certification-card__top">
          <h4 className="certification-card__name">{name}</h4>
          <VisibilityChip value={visibility} />
        </div>
        <p className="certification-card__issuer">{issuer}</p>
      </div>
      <div className="certification-card__body">
        {(issueDate || expireDate) && (
          <div className="certification-card__dates">
            {issueDate && <span className="certification-card__date">Issued: {issueDate}</span>}
            {expireDate && <span className="certification-card__date">Expires: {expireDate}</span>}
          </div>
        )}
        {score && <p className="certification-card__score">Score: {score}</p>}
        {credentialId && <p className="certification-card__credential-id">Credential ID: {credentialId}</p>}
        {media.length > 0 && (
          <div className="certification-card__media">
            {media.map((m) => (
              <span key={m.id} className="certification-card__file">
                File: {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="certification-card__actions">
        <button
          className="ghost-btn ghost-btn--sm"
          onClick={() => onEdit(license)}
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
