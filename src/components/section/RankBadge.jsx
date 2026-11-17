/** ============================================================================
 * RankBadge — small purple circle with a white number
 * ============================================================================ */
export default function RankBadge({ rank }) {
  return <span className="rank-badge" aria-hidden="true">{rank}</span>
}
