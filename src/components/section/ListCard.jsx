/** ============================================================================
 * ListCard — emoji tile, title (max 2 lines), subtitle/score slot, grey meta
 * line, optional chip row, pill row, "⋯" menu. Optional drag handle and rank
 * badge. Selected = 2 px purple border + light purple tint.
 * ============================================================================ */
import { useRef, useState, useEffect } from 'react'

export default function ListCard({
  tile, title, sub, meta, chips, pills, foot, handle,
  selected, isNew, menu, onClick, className = '',
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const classes = [
    'list-card',
    selected && 'list-card--selected',
    isNew && 'list-card--new',
    className,
  ].filter(Boolean).join(' ')

  return (
    <article
      className={classes}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
    >
      {handle && <span className="list-card__tile">{handle}</span>}
      {tile && <span className="list-card__tile" aria-hidden="true">{tile}</span>}
      <div className="list-card__text">
        {title && <h3>{title}</h3>}
        {sub && <p className="list-card__sub">{sub}</p>}
        {meta && <span className="list-card__meta">{meta}</span>}
        {chips && <div className="list-card__chips">{chips}</div>}
      </div>
      <div className="list-card__foot">
        {pills}
        {foot}
        {menu}
      </div>
    </article>
  )
}
