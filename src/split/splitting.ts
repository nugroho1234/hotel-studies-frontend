// Phrase splitting logic. All offsets are Unicode code points, half-open [start, end),
// counted on the review text exactly as stored (nothing trimmed or normalised).

export type Phrase = { start: number; end: number }

const WS = /\s/u

const PUNCT = /[.,!?;:…]/u
const LETTER = /\p{L}/u
// Emoji components. A ZWJ joins two emoji into one, so a cut never follows it.
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\ufe0f]/u

// A "word" is a run of non-whitespace, cut where sentence punctuation is glued to a following letter
// ("clean.Then" -> "clean." + "Then"). Not cut: digits ("4.5"), hyphens ("AC-nya"), and single-letter
// abbreviations ("e.g.the"). shortcut: "hotel.com" or "a@b.com" also get cut; upgrade if URLs/emails matter.
function words(cps: string[]): Phrase[] {
  const out: Phrase[] = []
  let s = -1
  const cut = (i: number) => {
    if (s < 0 || i <= s || !LETTER.test(cps[i])) return false
    if (EMOJI.test(cps[i - 1])) return true // "life 🥰thank": an emoji ends its clause (codebook: emojis)
    if (!PUNCT.test(cps[i - 1])) return false
    let j = i - 1
    while (j > s && PUNCT.test(cps[j - 1])) j--
    const abbrev = j - 1 >= s && LETTER.test(cps[j - 1]) && (j - 2 < s || !LETTER.test(cps[j - 2]))
    return j > s && !abbrev
  }
  for (let i = 0; i <= cps.length; i++) {
    const ws = i === cps.length || WS.test(cps[i])
    if (!ws && s >= 0 && cut(i)) {
      out.push({ start: s, end: i })
      s = i
    }
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

/** True if the phrase holds a letter or digit. Emoji and punctuation alone are never a phrase (codebook). */
export function hasContent(text: string, p: Phrase): boolean {
  return /[\p{L}\p{N}]/u.test(phraseText(text, p))
}

/** Every word covered; a review with no words can never be complete. */
export function isComplete(text: string, phrases: Phrase[]): boolean {
  return words(Array.from(text)).length > 0 && uncoveredWords(text, phrases).length === 0
}
