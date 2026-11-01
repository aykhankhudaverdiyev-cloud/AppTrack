/**
 * Text helpers shared across components and stores.
 */

/** Count words (whitespace-separated tokens) — essays, activity descriptions. */
export function countWords(text) {
  if (!text) return 0
  const matches = String(text).match(/\S+/g)
  return matches ? matches.length : 0
}
