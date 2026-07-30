import './VisibilityToggle.css'

export default function VisibilityChip({ value }) {
  const isPublic = value === 'public'

  return (
    <span className="vis-chip">
      {isPublic ? '🌐 Public' : '🔒 Private'}
    </span>
  )
}