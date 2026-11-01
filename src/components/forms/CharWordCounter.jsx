/**
 * ============================================================================
 * CharWordCounter — live character AND word counter (principle #4)
 * ============================================================================
 * Portals count differently: Common App Activities = CHARACTERS (50/100/150),
 * essays = WORDS (250–650), UCAS = CHARACTERS (4000). Students lose points
 * when they mix these up — so we always show both, with the binding one bold.
 *
 * <CharWordCounter value={text} maxChars={150} maxWords={null} />
 * ============================================================================
 */
import { countWords } from '../../utils/text'
import './forms.css'

export function CharWordCounter({
  value = '',
  maxChars,
  maxWords,
  minWords,
  compact = false,
}) {
  const text = typeof value === 'string' ? value : ''
  const chars = text.length
  const words = countWords(text)

  const overChars = typeof maxChars === 'number' && chars > maxChars
  const overWords = typeof maxWords === 'number' && words > maxWords
  const underWords = typeof minWords === 'number' && words > 0 && words < minWords
  const nearChars =
    typeof maxChars === 'number' && !overChars && chars >= maxChars * 0.9
  const nearWords =
    typeof maxWords === 'number' && !overWords && words >= maxWords * 0.9

  const parts = []
  if (typeof maxChars === 'number') {
    parts.push(
      <span key="c" className={`cwc-part${overChars ? ' cwc-over' : nearChars ? ' cwc-near' : ''}${maxWords == null ? ' cwc-primary' : ''}`}>
        {chars}/{maxChars} chars
      </span>
    )
  }
  if (typeof maxWords === 'number' || typeof minWords === 'number') {
    parts.push(
      <span key="w" className={`cwc-part${overWords || underWords ? ' cwc-over' : nearWords ? ' cwc-near' : ''}${maxChars == null ? ' cwc-primary' : ''}`}>
        {words}
        {typeof maxWords === 'number' ? `/${maxWords}` : ''}
        {typeof minWords === 'number' ? ` (min ${minWords})` : ''} words
      </span>
    )
  }
  if (maxChars == null && maxWords == null) {
    parts.push(
      <span key="f" className="cwc-part">
        {chars} chars · {words} words
      </span>
    )
  }

  const warning = overChars || overWords
    ? 'Over the limit — the portal may cut this off or reject it'
    : underWords
      ? `Minimum ${minWords} words required`
      : null

  return (
    <div className={`cwc${compact ? ' cwc-compact' : ''}`} role="status">
      <span className="cwc-counts">{parts}</span>
      {warning && <span className="cwc-warning">{warning}</span>}
    </div>
  )
}

export default CharWordCounter
