// Phrase splitting logic. All offsets are Unicode code points, half-open [start, end),
// counted on the review text exactly as stored (nothing trimmed or normalised).

export type Phrase = { start: number; end: number }

const WS = /\s/u

// shortcut: a "word" is a run of non-whitespace, so punctuation inside a run ("AC-nya", "Mr.", "clean.Then")
// never splits it; upgrade if coders need to split inside such runs.
function words(cps: string[]): Phrase[] {
  const out: Phrase[] = []
  let s = -1
  for (let i = 0; i <= cps.length; i++) {
    const ws = i === cps.length || WS.test(cps[i])
    if (!ws && s < 0) s = i
    if (ws && s >= 0) {
      out.push({ start: s, end: i })
      s = -1
    }
  }
  return out
}

/** Convert a UTF-16 index (what the browser gives) into a code-point offset. */
export function utf16ToCodePoint(text: string, index: number): number {
  return Array.from(text.slice(0, index)).length
}

/** Snap a raw selection outward to whole words. Null if it touches no word. */
export function snapSelection(text: string, a: number, b: number): Phrase | null {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  if (lo === hi) return null // a click, not a highlight
  const hit = words(Array.from(text)).filter((w) => w.start < hi && w.end > lo)
  if (hit.length === 0) return null
  return { start: hit[0].start, end: hit[hit.length - 1].end }
}

/** Add a phrase, keeping order. Null if it overlaps an existing one. */
export function addPhrase(phrases: Phrase[], p: Phrase): Phrase[] | null {
  if (phrases.some((q) => p.start < q.end && q.start < p.end)) return null
  return [...phrases, p].sort((x, y) => x.start - y.start)
}

export function phraseText(text: string, p: Phrase): string {
  return Array.from(text).slice(p.start, p.end).join('')
}

/** Words not inside any phrase. */
export function uncoveredWords(text: string, phrases: Phrase[]): Phrase[] {
  return words(Array.from(text)).filter((w) => !phrases.some((p) => p.start <= w.start && w.end <= p.end))
}

/** Every word covered; a review with no words can never be complete. */
export function isComplete(text: string, phrases: Phrase[]): boolean {
  return words(Array.from(text)).length > 0 && uncoveredWords(text, phrases).length === 0
}
