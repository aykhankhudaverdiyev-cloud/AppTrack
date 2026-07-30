// Shared avatar with a professional, face-safe image treatment.
// object-position is biased toward the upper third so portraits never crop to
// "neck only". Falls back to initials on a branded gradient when no photo exists.
export default function Avatar({ name = '', photoUrl = '', size = 'md', badge = null, className = '' }) {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <span className={`avatar avatar--${size} ${className}`}>
      {photoUrl ? (
        <img className="avatar__img" src={photoUrl} alt={name} loading="lazy" />
      ) : (
        <span className="avatar__initials">{initials || '?'}</span>
      )}
      {badge}
    </span>
  )
}
