export default function PublicStudentDrawer({ student, onClose }) {
  if (!student) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">Public Student Profile</p>
            <h3>{student.fullName || student.full_name || 'Student'}</h3>
          </div>

          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal__form">
          <p>
            <strong>Major:</strong> {student.major || "-"}
          </p>

          <p>
            <strong>University:</strong> {student.university || "-"}
          </p>

          <p>
            <strong>Email:</strong> {student.email || "-"}
          </p>

          <p>
            <strong>Phone:</strong> {student.phone || "-"}
          </p>
        </div>
      </div>
    </div>
  )
}