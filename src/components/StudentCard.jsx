import Avatar from './Avatar'
import './Avatar.css'

export default function StudentCard({ student, onClick }) {
  const profilePublic = student.visibility?.profile === 'public'

  const publicCount =
    (student.visibility?.profile === 'public' ? 1 : 0) +
    (student.applications || []).filter(a => a.visibility === 'public').length +
    (student.licenses || []).filter(l => l.visibility === 'public').length

  return (
    <button className="student-card" onClick={() => onClick(student)}>
      <div className="student-card__media">
        <Avatar
          paramsName={student.fullName}
          photoUrl={student.photoUrl}
          size="lg"
          className="student-card__avatar-el"
        />

        <span
          className={`vis-chip ${
            profilePublic ? 'vis-chip--public' : 'vis-chip--private'
          } student-card__vis`}
        >
          {profilePublic ? 'Public' : 'Private'}
        </span>

        {publicCount > 0 && (
          <span className="student-card__public-tag">
            {publicCount} public
          </span>
        )}
      </div>

      <div className="student-card__body">
        <h4>{student.fullName}</h4>
        <p>{student.major}</p>
      </div>
    </button>
  )
}