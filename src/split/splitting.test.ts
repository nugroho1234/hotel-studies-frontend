import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  isComplete,
  phraseText,
  sameSplit,
  segmentsOf,
  snapSelection,
  uncoveredWords,
  utf16ToCodePoint,
  type Phrase,
} from './splitting'

const ROOM = 'The room is old but clean.'

describe('snapSelection', () => {
  it('matches the owner example: [0,15) and [16,26)', () => {
    expect(snapSelection(ROOM, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(snapSelection(ROOM, 16, 26)).toEqual({ start: 16, end: 26 })
    expect(phraseText(ROOM, { start: 16, end: 26 })).toBe('but clean.')
  })

  it('snaps outward to whole words', () => {
    // "he room is ol" -> "The room is old"
    expect(snapSelection(ROOM, 1, 13)).toEqual({ start: 0, end: 15 })
  })

  it('drops leading and trailing whitespace', () => {
    expect(snapSelection(ROOM, 3, 16)).toEqual({ start: 4, end: 15 })
  })

  it('keeps trailing punctuation with the word before it', () => {
    expect(snapSelection(ROOM, 16, 25)).toEqual({ start: 16, end: 26 })
  })

  it('treats abbreviations like "Mr." as one word', () => {
    const t = 'Mr. Budi was kind.'
    expect(snapSelection(t, 0, 2)).toEqual({ start: 0, end: 3 })
  })

  it('works on Indonesian text', () => {
    const t = 'Kamarnya bersih tapi AC-nya mati.'
    expect(snapSelection(t, 17, 33)).toEqual({ start: 16, end: 33 })
  })

  it('handles double spaces and line breaks', () => {
    const t = 'Good bed.  \n\nBad  wifi.'
    expect(snapSelection(t, 0, 20)).toEqual({ start: 0, end: 23 })
    expect(snapSelection(t, 9, 13)).toBeNull()
    expect(snapSelection(t, 13, 19)).toEqual({ start: 13, end: 23 })
  })

  it('counts code points, not UTF-16 units, around emoji', () => {
    const t = 'Great 😀 stay'
    // code points: G0 r1 e2 a3 t4 ' '5 😀6 ' '7 s8 t9 a10 y11
    expect(snapSelection(t, 6, 7)).toEqual({ start: 6, end: 7 })
    expect(snapSelection(t, 8, 12)).toEqual({ start: 8, end: 12 })
    expect(utf16ToCodePoint(t, 9)).toBe(8)
  })

  it('returns null for a selection with no word, or an empty one', () => {
    expect(snapSelection(ROOM, 15, 16)).toBeNull()
    expect(snapSelection(ROOM, 5, 5)).toBeNull()
  })

  it('accepts a reversed selection', () => {
    expect(snapSelection(ROOM, 15, 0)).toEqual({ start: 0, end: 15 })
  })
})

describe('glued punctuation', () => {
  it('splits "clean.Then" and "clean,then" into phrases', () => {
    const a = 'Room was clean.Then we left.'
    expect(snapSelection(a, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(snapSelection(a, 15, 28)).toEqual({ start: 15, end: 28 })
    const b = 'Room was clean,then we left.'
    expect(snapSelection(b, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(isComplete(b, [{ start: 0, end: 15 }])).toBe(false)
    expect(isComplete(b, [{ start: 0, end: 15 }, { start: 15, end: 28 }])).toBe(true)
  })

  it('keeps decimals, hyphens and abbreviations whole', () => {
    expect(snapSelection('Rated 4.5 stars', 6, 7)).toEqual({ start: 6, end: 9 })
    expect(snapSelection('AC-nya mati', 0, 2)).toEqual({ start: 0, end: 6 })
    expect(snapSelection('e.g.the pool', 0, 1)).toEqual({ start: 0, end: 2 }) // v0.2 tokeniser: no abbreviation exception
  })

  it('cuts after a run like "..."', () => {
    expect(snapSelection('ok...Then go', 0, 2)).toEqual({ start: 0, end: 5 })
  })
})

describe('emoji (codebook rule)', () => {
  const t = 'Good life 🥰thank you'
  it('splits an emoji from a letter glued after it', () => {
    expect(snapSelection(t, 0, 11)).toEqual({ start: 0, end: 11 })
    expect(snapSelection(t, 11, 20)).toEqual({ start: 11, end: 20 })
  })
  it('handles skin-tone and variation-selector emoji', () => {
    expect(snapSelection('👍🏽thanks', 0, 1)).toEqual({ start: 0, end: 2 })
    expect(snapSelection('❤️thanks', 0, 1)).toEqual({ start: 0, end: 2 })
  })
  it('does not cut inside a ZWJ emoji or before a space', () => {
    expect(snapSelection('👨\u200d👩 ok', 0, 1)).toEqual({ start: 0, end: 3 })
  })
  it('an emoji alone can be a phrase (v0.2)', () => {
    expect(snapSelection('Nice 😍 room', 5, 6)).toEqual({ start: 5, end: 6 })
  })
  it('keeps an emoji run whole, even with spaces inside it', () => {
    expect(snapSelection('Nice 😍 😍 room', 5, 6)).toEqual({ start: 5, end: 8 })
  })
  it('keeps ZWJ family, flag and keycap emoji whole', () => {
    expect(snapSelection('a 👨‍👩‍👧 b', 2, 3)).toEqual({ start: 2, end: 7 })
    expect(snapSelection('a 🇮🇩 b', 2, 3)).toEqual({ start: 2, end: 4 })
    expect(snapSelection('a 1️⃣ b', 2, 3)).toEqual({ start: 2, end: 5 })
    expect(snapSelection('Nice1️⃣Great', 0, 3)).toEqual({ start: 0, end: 7 })
  })
})

describe('text emoticons', () => {
  it('splits "stay:)thank" after the emoticon, which stays with the word before', () => {
    const t = 'Great stay:)thank you'
    expect(snapSelection(t, 0, 12)).toEqual({ start: 0, end: 12 })
    expect(snapSelection(t, 12, 21)).toEqual({ start: 12, end: 21 })
    expect(snapSelection('stay :-(sad', 5, 8)).toEqual({ start: 0, end: 8 }) // punctuation-only token joins the word before
  })
  it('cuts after a closing bracket before a letter (v0.2 end punctuation)', () => {
    expect(snapSelection('good(ish)stay', 0, 2)).toEqual({ start: 0, end: 9 })
  })
})

describe('addPhrase', () => {
  it('keeps phrases ordered and rejects overlap', () => {
    const a = addPhrase([], { start: 16, end: 26 })
    expect(a).toEqual([{ start: 16, end: 26 }])
    const b = addPhrase(a as Phrase[], { start: 0, end: 15 })
    expect(b).toEqual([
      { start: 0, end: 15 },
      { start: 16, end: 26 },
    ])
    expect(addPhrase(b as Phrase[], { start: 10, end: 20 })).toBeNull()
  })
})

describe('coverage', () => {
  it('is complete only when every word is inside a phrase', () => {
    expect(isComplete(ROOM, [])).toBe(false)
    expect(isComplete(ROOM, [{ start: 0, end: 15 }])).toBe(false)
    expect(uncoveredWords(ROOM, [{ start: 0, end: 15 }])).toEqual([{ start: 16, end: 19 }, { start: 20, end: 26 }])
    expect(
      isComplete(ROOM, [
        { start: 0, end: 15 },
        { start: 16, end: 26 },
      ]),
    ).toBe(true)
    expect(isComplete(ROOM, [{ start: 0, end: 26 }])).toBe(true)
  })

  it('treats an empty or blank review as not complete', () => {
    expect(isComplete('   ', [])).toBe(false)
  })
})

describe('segmentsOf and sameSplit', () => {
  it('cuts text into gaps and phrases', () => {
    expect(segmentsOf(26, [{ start: 16, end: 26 }, { start: 0, end: 15 }])).toEqual([
      { start: 0, end: 15, n: 0 },
      { start: 15, end: 16, n: null },
      { start: 16, end: 26, n: 1 },
    ])
    expect(segmentsOf(5, [])).toEqual([{ start: 0, end: 5, n: null }])
  })
  it('compares splits regardless of order', () => {
    expect(sameSplit([{ start: 16, end: 26 }, { start: 0, end: 15 }], [{ start: 0, end: 15 }, { start: 16, end: 26 }])).toBe(true)
    expect(sameSplit([{ start: 0, end: 26 }], [{ start: 0, end: 15 }, { start: 16, end: 26 }])).toBe(false)
  })
})

describe('v0.2 tokeniser cases', () => {
  const cut = (t: string, sel: [number, number][]) => sel.map(([a, b]) => snapSelection(t, a, b))
  it('case 6: emoji glued after a full stop is its own phrase', () => {
    expect(cut('Thank you for the suprise,Hendrik.😁 Great stay!', [[0, 34], [34, 35], [36, 47]]))
      .toEqual([{ start: 0, end: 34 }, { start: 34, end: 35 }, { start: 36, end: 47 }])
  })
  it('case 8: emoji glued before a letter is its own phrase', () => {
    expect(cut('Thank you for the suprise,Hendrik. 😁Great stay!', [[0, 34], [35, 36], [36, 47]]))
      .toEqual([{ start: 0, end: 34 }, { start: 35, end: 36 }, { start: 36, end: 47 }])
  })
  it('case 9: a double space inside a phrase is kept', () => {
    expect(cut('Stafnya ramah dan sangat  tanggap.', [[0, 13], [14, 34]])).toEqual([{ start: 0, end: 13 }, { start: 14, end: 34 }])
    expect(phraseText('Stafnya ramah dan sangat  tanggap.', { start: 14, end: 34 })).toBe('dan sangat  tanggap.')
  })
  it('splits lowercase|Uppercase, keeps hashtags and numbers whole', () => {
    expect(snapSelection('light Kolam', 0, 1)).toEqual({ start: 0, end: 5 })
    expect(snapSelection('lightKolam', 0, 1)).toEqual({ start: 0, end: 5 })
    expect(snapSelection('#kolamRenang ok', 0, 1)).toEqual({ start: 0, end: 12 })
    expect(snapSelection('Rp1.500.000 ok', 0, 1)).toEqual({ start: 0, end: 11 })
  })
  it('a lone full stop joins the phrase before it', () => {
    expect(snapSelection('here .The end', 0, 4)).toEqual({ start: 0, end: 6 })
  })
})
