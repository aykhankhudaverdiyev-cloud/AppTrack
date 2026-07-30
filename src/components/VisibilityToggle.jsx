import './VisibilityToggle.css'

export default function VisibilityToggle({ value, onChange }) {
  const isPublic = value === 'public'

  return (
    <button
      type="button"
      className={`vis-toggle ${isPublic ? 'vis-toggle--public' : 'vis-toggle--private'}`}
      onClick={() => onChange?.(isPublic ? 'private' : 'public')}
      aria-pressed={isPublic}
    >
      <span className="vis-toggle__icon" aria-hidden="true">
        {isPublic ? '🌐' : '🔒'}
      </span>
      <span>{isPublic ? 'Public' : 'Private'}</span>
    </button>
  )
}