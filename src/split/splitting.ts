// Phrase splitting logic. All offsets are Unicode code points, half-open [start, end),
// counted on the review text exactly as stored (nothing trimmed or normalised).

export type Phrase = { start: number; end: number }

const WS = /\s/u

const LETTER = /\p{L}/u
const UPPER = /\p{Lu}/u
const LOWER = /\p{Ll}/u
const DIGIT = /\p{Nd}/u
// Where a split becomes possible after this character when a letter or emoji follows (codebook v0.2, tokeniser).
const END_PUNCT = new Set('.,;:!?…)]}"”’')
const OPENERS = new Set('([{"“‘')
// Emoji parts. Modifiers (ZWJ, variation selector, skin tone, keycap) stay with the emoji before them.
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\ufe0f\u200d\u20e3]/u
const MOD = /[\p{Emoji_Modifier}\ufe0f\u200d\u20e3]/u
// Text emoticons count like emoji. Only symbol-ending ones (":)", ":-(", ";)", "=)", "<3", "^_^"): ":D" or ":P" would
// cut "Note:Dont" wrongly. shortcut: add more only if real reviews need them.
const EMOTICON = /(?:[:;=][-']?[)(]|<3|\^_?\^)$/

// Code-point indexes where a grapheme cluster starts: a cut is never allowed anywhere else (👨‍👩‍👧, 🇮🇩, 1️⃣ stay whole).
function graphemeStarts(text: string): Set<number> {
  const out = new Set<number>()
  let at = 0
  for (const g of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    out.add(at)
    at += Array.from(g.segment).length
  }
  out.add(at)
  return out
}

/** The snapping tokens (codebook v0.2): runs of non-space, cut after end punctuation before a letter or emoji (not inside
 *  numbers like 4.5), between lowercase and Uppercase (light|Kolam), and where emoji meets text. An emoji run is one token even
 *  with spaces inside it. A punctuation-only token joins the token before it (an opening bracket or quote, the one after). */
function words(cps: string[]): Phrase[] {
  const ok = graphemeStarts(cps.join(''))
  const isEmoji = (c: string) => EMOJI.test(c)
  const raw: Phrase[] = []
  let s = -1
  const cut = (i: number) => {
    const a = cps[i - 1], b = cps[i]
    if (!ok.has(i) || (cps[s] === '#' && !END_PUNCT.has(a))) return false // hashtags stay whole
    if (END_PUNCT.has(a) && !END_PUNCT.has(b)) {
      if ((a === '.' || a === ',') && DIGIT.test(b) && i - 2 >= s && DIGIT.test(cps[i - 2])) return false // 4.5, 1,500
      if (a === '’' && LETTER.test(b)) return false // it’s
      return LETTER.test(b) || isEmoji(b)
    }
    if (LOWER.test(a) && UPPER.test(b)) return true
    if (isEmoji(a) !== isEmoji(b) && !MOD.test(b)) return true
    return EMOTICON.test(cps.slice(Math.max(s, i - 4), i).join('')) && LETTER.test(b)
  }
  for (let i = 0; i <= cps.length; i++) {
    const ws = i === cps.length || WS.test(cps[i])
    if (!ws && s >= 0 && cut(i)) {
      raw.push({ start: s, end: i })
      s = i
    }
    if (!ws && s < 0) s = i
    if (ws && s >= 0) {
      raw.push({ start: s, end: i })
      s = -1
    }
  }
  // Merge: emoji runs split by spaces, then punctuation-only tokens.
  const only = (t: Phrase, f: (c: string) => boolean) => cps.slice(t.start, t.end).every(f)
  const out: Phrase[] = []
  let pendingOpener: Phrase | null = null
  for (const t of raw) {
    const prev = out[out.length - 1]
    const gap = prev ? cps.slice(prev.end, t.start).join('') : ''
    if (pendingOpener) { t.start = pendingOpener.start; pendingOpener = null }
    if (prev && /^[ \t]+$/.test(gap) && only(t, isEmoji) && only(prev, isEmoji)) prev.end = t.end
    else if (prev && only(t, (c) => !LETTER.test(c) && !DIGIT.test(c) && !isEmoji(c)) && !(t.end - t.start === 1 && OPENERS.has(cps[t.start]))) prev.end = t.end
    else if (only(t, (c) => OPENERS.has(c))) pendingOpener = t
    else out.push({ ...t })
  }
  if (pendingOpener) out.push(pendingOpener) // an opener at the very end stands alone
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

export type Segment = { start: number; end: number; n: number | null } // n = phrase index, null = text outside any phrase

/** Cut the text into alternating gaps and phrases, for drawing. */
export function segmentsOf(length: number, phrases: Phrase[]): Segment[] {
  const out: Segment[] = []
  let at = 0
  ;[...phrases].sort((a, b) => a.start - b.start).forEach((p, n) => {
    if (p.start > at) out.push({ start: at, end: p.start, n: null })
    out.push({ start: p.start, end: p.end, n })
    at = p.end
  })
  if (at < length) out.push({ start: at, end: length, n: null })
  return out
}

/** Same phrases at the same offsets. */
export function sameSplit(a: Phrase[], b: Phrase[]): boolean {
  const key = (ps: Phrase[]) => [...ps].sort((x, y) => x.start - y.start).map((p) => `${p.start}-${p.end}`).join(',')
  return key(a) === key(b)
}
